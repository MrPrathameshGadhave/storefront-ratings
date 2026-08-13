import { Router } from "express";
import { sortDirection } from "../lib/query.js";
import { prisma } from "../lib/prisma.js";
import { allowRoles, authenticate, type AuthenticatedRequest } from "../middleware/auth.js";

type Rater = {
  id: string;
  value: number;
  updatedAt: Date;
  user: { id: string; name: string; email: string; address: string };
};

const sortRaters = (raters: Rater[], sortBy: string, direction: "asc" | "desc"): Rater[] => {
  const sorted = [...raters].sort((left, right) => {
    const a =
      sortBy === "rating"
        ? left.value
        : sortBy === "email"
          ? left.user.email
          : sortBy === "address"
            ? left.user.address
            : left.user.name;
    const b =
      sortBy === "rating"
        ? right.value
        : sortBy === "email"
          ? right.user.email
          : sortBy === "address"
            ? right.user.address
            : right.user.name;
    return typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b));
  });
  return direction === "desc" ? sorted.reverse() : sorted;
};

export const ownerRouter = Router();

ownerRouter.get(
  "/dashboard",
  authenticate,
  allowRoles("STORE_OWNER"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const store = await prisma.store.findUnique({
        where: { ownerId: req.auth!.id },
        include: {
          ratings: {
            include: { user: { select: { id: true, name: true, email: true, address: true } } },
          },
        },
      });
      if (!store) {
        res.json({ data: { store: null, raters: [] } });
        return;
      }
      const total = store.ratings.reduce((sum, rating) => sum + rating.value, 0);
      const sortBy = String(req.query.sortBy ?? "name");
      const sortDir = sortDirection(req.query.sortDir);
      const raters = sortRaters(
        store.ratings.map((rating) => ({
          id: rating.id,
          value: rating.value,
          updatedAt: rating.updatedAt,
          user: rating.user,
        })),
        ["name", "email", "address", "rating"].includes(sortBy) ? sortBy : "name",
        sortDir,
      );
      res.json({
        data: {
          store: {
            id: store.id,
            name: store.name,
            email: store.email,
            address: store.address,
            averageRating: store.ratings.length
              ? Number((total / store.ratings.length).toFixed(1))
              : null,
            ratingCount: store.ratings.length,
          },
          raters,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
