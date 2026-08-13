import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

export const hashPassword = async (password: string): Promise<string> => bcrypt.hash(password, 12);

export const verifyPassword = async (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

export const createOtp = (): string => randomInt(0, 1_000_000).toString().padStart(6, "0");

export const hashOtp = (otp: string): string =>
  createHmac("sha256", env.jwtSecret).update(otp).digest("hex");

export const verifyOtpHash = (otp: string, storedHash: string): boolean => {
  const candidate = Buffer.from(hashOtp(otp), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
};

const hashSecret = (purpose: string, value: string): string =>
  createHmac("sha256", env.jwtSecret).update(`${purpose}:${value}`).digest("hex");

const safelyEqualsHash = (leftHash: string, rightHash: string): boolean => {
  const left = Buffer.from(leftHash, "hex");
  const right = Buffer.from(rightHash, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
};

const verifySecretHash = (purpose: string, value: string, storedHash: string): boolean => {
  return safelyEqualsHash(hashSecret(purpose, value), storedHash);
};

const invitationCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A 256-bit opaque URL-safe secret. Only its HMAC digest is stored. */
export const createInvitationToken = (): string => randomBytes(32).toString("base64url");

/** Eight characters from an unambiguous 32-character alphabet (40 bits of entropy). */
export const createInvitationCode = (): string =>
  Array.from(
    { length: 8 },
    () => invitationCodeAlphabet[randomInt(0, invitationCodeAlphabet.length)],
  ).join("");

export const hashInvitationToken = (token: string): string => hashSecret("invitation-token", token);

export const hashInvitationCode = (code: string): string => hashSecret("invitation-code", code);

export const verifyInvitationCodeHash = (code: string, storedHash: string): boolean =>
  verifySecretHash("invitation-code", code, storedHash);

type AdminBootstrapCredentials = { token: string; code: string; expiresAt: Date };

const activeAdminBootstrapCredentials = (): AdminBootstrapCredentials | null => {
  const token = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const code = process.env.ADMIN_BOOTSTRAP_CODE;
  const expiresAtRaw = process.env.ADMIN_BOOTSTRAP_EXPIRES_AT;
  if (!token || !code || !expiresAtRaw) return null;
  const expiresAt = new Date(expiresAtRaw);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) return null;
  return { token, code, expiresAt };
};

/**
 * Returns true only when both server-only bootstrap secrets match. These values
 * are deliberately read at request time so they never need to be stored or
 * returned by the application.
 */
export const verifyAdminBootstrapCredentials = (token: string, code: string): boolean => {
  const credentials = activeAdminBootstrapCredentials();
  if (!credentials) return false;
  return (
    safelyEqualsHash(
      hashSecret("admin-bootstrap-token", token),
      hashSecret("admin-bootstrap-token", credentials.token),
    ) &&
    safelyEqualsHash(
      hashSecret("admin-bootstrap-code", code),
      hashSecret("admin-bootstrap-code", credentials.code),
    )
  );
};

export const getAdminBootstrapExpiry = (token: string): Date | null => {
  const credentials = activeAdminBootstrapCredentials();
  if (!credentials) return null;
  return safelyEqualsHash(
    hashSecret("admin-bootstrap-token", token),
    hashSecret("admin-bootstrap-token", credentials.token),
  )
    ? credentials.expiresAt
    : null;
};

export const matchesAdminBootstrapToken = (token: string): boolean =>
  getAdminBootstrapExpiry(token) !== null;
