import type { RequestHandler } from "express";
import { AppError } from "../lib/app-error.js";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

const pruneExpiredBuckets = (now: number): void => {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey) buckets.delete(oldestKey);
  }
};

export const createRateLimit =
  (windowMs: number, max: number): RequestHandler =>
  (req, _res, next) => {
    const key = `${req.path}:${req.ip ?? "unknown"}`;
    const now = Date.now();
    pruneExpiredBuckets(now);
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= max) {
      next(new AppError(429, "RATE_LIMITED", "Too many requests. Please try again shortly."));
      return;
    }
    bucket.count += 1;
    next();
  };

export const resetRateLimitsForTests = (): void => buckets.clear();
