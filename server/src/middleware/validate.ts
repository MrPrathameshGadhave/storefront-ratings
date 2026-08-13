import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError, zodIssuesToFields } from "../lib/app-error.js";

export const validateBody =
  <T>(schema: ZodType<T>): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new AppError(
          422,
          "VALIDATION_ERROR",
          "Please correct the highlighted fields.",
          zodIssuesToFields(result.error.issues),
        ),
      );
      return;
    }
    req.body = result.data;
    next();
  };
