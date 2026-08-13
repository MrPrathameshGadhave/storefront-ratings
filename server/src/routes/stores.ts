import { Router } from "express";
import { AppError } from "../lib/app-error.js";
import { sortDirection } from "../lib/query.js";
import { prisma } from "../lib/prisma.js";
import { allowRoles, authenticate, type AuthenticatedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { ratingSchema } from "../schemas/rating.js";

const sortableFields = ["name", "address", "email", "createdAt"] as const;
type StoreSortField = (typeof sortableFields)[number];

const toStoreSummary = (
  store: {
    id: string;
    name: string;
    email: string;
    address: string;
    createdAt: Date;
    ratings: { value: number; userId: string }[];
  },
  userId: string,
) => {
  const ratingCount = store.ratings.length;
  const ratingTotal = store.ratings.reduce((total, rating) => total + rating.value, 0);
  return {
    id: store.id,
    name: store.name,
    email: store.email,
    address: store.address,
    createdAt: store.createdAt,
    averageRating: ratingCount ? Number((ratingTotal / ratingCount).toFixed(1)) : null,
    ratingCount,
    submittedRating: store.ratings.find((rating) => rating.userId === userId)?.value ?? null,
  };
};

export const storesRouter = Router();

storesRouter.get(
  "/",
  authenticate,
  allowRoles("NORMAL_USER"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const search = String(req.query.search ?? "").trim();
      const requestedSort = String(req.query.sortBy ?? "name");
      const sortBy: StoreSortField = sortableFields.includes(requestedSort as StoreSortField)
        ? (requestedSort as StoreSortField)
        : "name";
      const sortDir = sortDirection(req.query.sortDir);
      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { address: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {};
      const stores = await prisma.store.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        include: {
          ratings: { select: { value: true, userId: true } },
        },
      });
      res.json({
        data: { stores: stores.map((store) => toStoreSummary(store, req.auth!.id)) },
      });
    } catch (error) {
      next(error);
    }
  },
);

storesRouter.put(
  "/:storeId/rating",
  authenticate,
  allowRoles("NORMAL_USER"),
  validateBody(ratingSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const rawStoreId = req.params.storeId;
      const storeId = Array.isArray(rawStoreId) ? rawStoreId[0] : rawStoreId;
      if (!storeId) throw new AppError(400, "INVALID_STORE", "A store identifier is required.");
      const { value } = req.body as { value: number };
      const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
      if (!store) throw new AppError(404, "STORE_NOT_FOUND", "This store no longer exists.");
      const rating = await prisma.rating.upsert({
        where: { userId_storeId: { userId: req.auth!.id, storeId } },
        create: { userId: req.auth!.id, storeId, value },
        update: { value },
      });
      const aggregate = await prisma.rating.aggregate({
        where: { storeId },
        _avg: { value: true },
        _count: true,
      });
      res.json({
        data: {
          rating: { id: rating.id, value: rating.value, updatedAt: rating.updatedAt },
          averageRating: aggregate._avg?.value ? Number(aggregate._avg.value.toFixed(1)) : null,
          ratingCount: aggregate._count,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
