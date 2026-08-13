import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { verifySession } from "../lib/token.js";
import { prisma } from "../lib/prisma.js";

export type AuthenticatedRequest = Request & {
  auth?: { id: string; role: Role };
};

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) => {
  const token = req.cookies?.session as string | undefined;
  if (!token) {
    next(new AppError(401, "UNAUTHENTICATED", "Sign in to continue."));
    return;
  }
  try {
    const session = verifySession(token);
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, role: true, emailVerified: true },
    });
    if (!user || !user.emailVerified) {
      next(new AppError(401, "UNAUTHENTICATED", "Sign in to continue."));
      return;
    }
    req.auth = { id: user.id, role: user.role };
    next();
  } catch {
    next(new AppError(401, "UNAUTHENTICATED", "Sign in to continue."));
  }
};

export const allowRoles =
  (...roles: Role[]) =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
      return;
    }
    next();
  };
