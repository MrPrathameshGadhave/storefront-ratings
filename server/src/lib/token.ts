import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";

export type SessionPayload = {
  sub: string;
  role: Role;
};

export const signSession = (payload: SessionPayload): string =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] });

export const verifySession = (token: string): SessionPayload =>
  jwt.verify(token, env.jwtSecret) as SessionPayload;
