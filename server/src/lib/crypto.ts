import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
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
