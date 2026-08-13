import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../lib/app-error.js";
import { logger } from "../lib/logger.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", `No route matches ${req.method} ${req.path}.`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    logger.warn("Duplicate record attempted", { code: error.code });
    res.status(409).json({
      error: { code: "DUPLICATE_RECORD", message: "A record with those details already exists." },
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    logger.warn("Record not found", { code: error.code });
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "The requested record was not found." } });
    return;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.warn("Database connection is unavailable", { code: error.errorCode });
    res.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "The service database is temporarily unavailable. Please try again shortly.",
      },
    });
    return;
  }
  logger.error(
    "Unhandled request error",
    error instanceof Error ? error : new Error(String(error)),
  );
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  });
};
