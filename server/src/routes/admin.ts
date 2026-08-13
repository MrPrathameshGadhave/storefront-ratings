import type { Prisma } from "@prisma/client";
import { Router } from "express";
import {
  auditLog,
  auditStoreCreated,
  auditStoreOwnerAssigned,
  auditUserCreated,
} from "../lib/audit.js";
import { AppError } from "../lib/app-error.js";
import {
  createInvitationCode,
  createInvitationToken,
  hashInvitationCode,
  hashInvitationToken,
  hashPassword,
} from "../lib/crypto.js";
import { sortDirection } from "../lib/query.js";
import { prisma } from "../lib/prisma.js";
import { allowRoles, authenticate, type AuthenticatedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { adminUserSchema, privilegedInvitationSchema, storeSchema } from "../schemas/account.js";

const PRIVILEGED_INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

const publicUser = (user: {
  id: string;
  name: string;
  email: string;
  address: string;
  role: string;
  emailVerified: boolean;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  address: user.address,
  role: user.role,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
});

const toStoreSummary = (store: {
  id: string;
  name: string;
  email: string;
  address: string;
  createdAt: Date;
  owner: { id: string; name: string; email: string } | null;
  ratings: { value: number }[];
}) => {
  const count = store.ratings.length;
  return {
    id: store.id,
    name: store.name,
    email: store.email,
    address: store.address,
    createdAt: store.createdAt,
    averageRating: count
      ? Number(
          (store.ratings.reduce((total, rating) => total + rating.value, 0) / count).toFixed(1),
        )
      : null,
    ratingCount: count,
    owner: store.owner,
  };
};

const userSortFields = ["name", "email", "address", "role", "createdAt"] as const;
type UserSortField = (typeof userSortFields)[number];
const storeSortFields = ["name", "email", "address", "createdAt"] as const;
type AdminStoreSortField = (typeof storeSortFields)[number];

export const adminRouter = Router();
adminRouter.use(authenticate, allowRoles("ADMIN"));

adminRouter.get("/dashboard", async (_req, res, next) => {
  try {
    const [userCount, storeCount, ratingCount] = await prisma.$transaction([
      prisma.user.count(),
      prisma.store.count(),
      prisma.rating.count(),
    ]);
    res.json({ data: { userCount, storeCount, ratingCount } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post(
  "/invitations",
  validateBody(privilegedInvitationSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = req.body as { email: string; role: "ADMIN" | "STORE_OWNER" };
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existingUser) {
        throw new AppError(409, "EMAIL_UNAVAILABLE", "An account already uses this email address.");
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + PRIVILEGED_INVITATION_TTL_MS);
      const token = createInvitationToken();
      const code = createInvitationCode();

      // Only the newest unredeemed invite for an email remains usable. The raw
      // secrets are intentionally returned once to the authenticated creator
      // and are never written to the database or audit log.
      await prisma.privilegedInvitation.updateMany({
        where: { email: input.email, usedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
      const invitation = await prisma.privilegedInvitation.create({
        data: {
          email: input.email,
          role: input.role,
          tokenHash: hashInvitationToken(token),
          codeHash: hashInvitationCode(code),
          expiresAt,
          createdById: req.auth!.id,
        },
        select: { id: true, email: true, role: true, expiresAt: true },
      });

      auditLog({
        action: "PRIVILEGED_INVITATION_CREATED",
        actorId: req.auth!.id,
        actorRole: "ADMIN",
        resourceType: "INVITATION",
        resourceId: invitation.id,
        changes: {
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        },
        status: "SUCCESS",
      });

      res.status(201).json({
        data: {
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          token,
          code,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

adminRouter.get("/users", async (req, res, next) => {
  try {
    const name = String(req.query.name ?? "").trim();
    const email = String(req.query.email ?? "").trim();
    const address = String(req.query.address ?? "").trim();
    const role = String(req.query.role ?? "").trim();
    const requestedSort = String(req.query.sortBy ?? "name");
    const sortBy: UserSortField = userSortFields.includes(requestedSort as UserSortField)
      ? (requestedSort as UserSortField)
      : "name";
    const sortDir = sortDirection(req.query.sortDir);
    const where: Prisma.UserWhereInput = {
      ...(name ? { name: { contains: name, mode: "insensitive" } } : {}),
      ...(email ? { email: { contains: email, mode: "insensitive" } } : {}),
      ...(address ? { address: { contains: address, mode: "insensitive" } } : {}),
      ...(role && ["ADMIN", "NORMAL_USER", "STORE_OWNER"].includes(role)
        ? { role: role as "ADMIN" | "NORMAL_USER" | "STORE_OWNER" }
        : {}),
    };
    const users = await prisma.user.findMany({ where, orderBy: { [sortBy]: sortDir } });
    res.json({ data: { users: users.map(publicUser) } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post(
  "/users",
  validateBody(adminUserSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = req.body as {
        name: string;
        email: string;
        address: string;
        password: string;
        role: "ADMIN" | "NORMAL_USER" | "STORE_OWNER";
      };
      const user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          address: input.address,
          passwordHash: await hashPassword(input.password),
          role: input.role,
          emailVerified: true,
        },
      });
      if (req.auth) {
        auditUserCreated(req.auth.id, user.id, user.email, user.role);
      }
      res.status(201).json({ data: { user: publicUser(user) } });
    } catch (error) {
      next(error);
    }
  },
);

adminRouter.get("/users/:userId", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: {
        ownedStores: { include: { ratings: { select: { value: true } } } },
      },
    });
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "This user could not be found.");
    const stores = user.ownedStores.map((store) => {
      const ratingCount = store.ratings.length;
      return {
        id: store.id,
        name: store.name,
        averageRating: ratingCount
          ? Number(
              (
                store.ratings.reduce((total, rating) => total + rating.value, 0) / ratingCount
              ).toFixed(1),
            )
          : null,
        ratingCount,
      };
    });
    res.json({ data: { user: publicUser(user), ownedStores: stores } });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/stores", async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const requestedSort = String(req.query.sortBy ?? "name");
    const sortBy: AdminStoreSortField = storeSortFields.includes(
      requestedSort as AdminStoreSortField,
    )
      ? (requestedSort as AdminStoreSortField)
      : "name";
    const sortDir = sortDirection(req.query.sortDir);
    const where: Prisma.StoreWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};
    const stores = await prisma.store.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        ratings: { select: { value: true } },
      },
    });
    res.json({ data: { stores: stores.map(toStoreSummary) } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post(
  "/stores",
  validateBody(storeSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = req.body as {
        name: string;
        email: string;
        address: string;
        ownerId?: string | null;
      };
      if (input.ownerId) {
        const owner = await prisma.user.findUnique({
          where: { id: input.ownerId },
          select: { id: true, role: true, ownedStores: { select: { id: true } } },
        });
        if (!owner || owner.role !== "STORE_OWNER") {
          throw new AppError(422, "INVALID_STORE_OWNER", "Select an eligible Store Owner.", {
            ownerId: "Select an eligible Store Owner.",
          });
        }
        if (owner.ownedStores.length > 0) {
          throw new AppError(
            409,
            "OWNER_ALREADY_ASSIGNED",
            "This Store Owner is already assigned to a store.",
            {
              ownerId: "This Store Owner is already assigned to a store.",
            },
          );
        }
      }
      const store = await prisma.store.create({
        data: {
          name: input.name,
          email: input.email,
          address: input.address,
          ownerId: input.ownerId ?? null,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          ratings: { select: { value: true } },
        },
      });
      if (req.auth) {
        auditStoreCreated(req.auth.id, store.id, store.name, input.ownerId || undefined);
        if (input.ownerId) {
          auditStoreOwnerAssigned(req.auth.id, store.id, input.ownerId);
        }
      }
      res.status(201).json({ data: { store: toStoreSummary(store) } });
    } catch (error) {
      next(error);
    }
  },
);
