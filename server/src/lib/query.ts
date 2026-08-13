import { AppError } from "./app-error.js";

export const sortDirection = (value: unknown): "asc" | "desc" =>
  value === "desc" ? "desc" : "asc";

export const pageLimit = (value: unknown, defaultValue = 20): number => {
  const parsed = Number(value ?? defaultValue);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new AppError(400, "INVALID_PAGE_SIZE", "Limit must be an integer between 1 and 100.");
  }
  return parsed;
};

export const pageOffset = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(400, "INVALID_OFFSET", "Offset must be a non-negative integer.");
  }
  return parsed;
};
