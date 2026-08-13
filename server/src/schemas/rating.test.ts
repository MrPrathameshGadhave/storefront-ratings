import { describe, expect, it } from "vitest";
import { ratingSchema } from "./rating.js";

describe("rating validation", () => {
  it.each([1, 2, 3, 4, 5])("allows rating %s", (value) => {
    expect(ratingSchema.safeParse({ value }).success).toBe(true);
  });

  it.each([0, 6, 2.5, "not-a-rating"])('rejects invalid rating "%s"', (value) => {
    expect(ratingSchema.safeParse({ value }).success).toBe(false);
  });
});
