import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ data: { status: "ok", database: "connected" } });
  } catch {
    res
      .status(503)
      .json({ error: { code: "DATABASE_UNAVAILABLE", message: "Database is unavailable." } });
  }
});
