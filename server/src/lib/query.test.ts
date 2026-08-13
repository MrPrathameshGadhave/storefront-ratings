import { describe, expect, it } from "vitest";
import { AppError } from "./app-error.js";
import { pageLimit, pageOffset, sortDirection } from "./query.js";

describe("query safety", () => {
  it("defaults sorting safely", () => {
    expect(sortDirection("anything")).toBe("asc");
    expect(sortDirection("desc")).toBe("desc");
  });

  it("bounds list pagination", () => {
    expect(pageLimit(undefined)).toBe(20);
    expect(pageLimit("100")).toBe(100);
    expect(pageOffset(undefined)).toBe(0);
    expect(() => pageLimit("101")).toThrow(AppError);
    expect(() => pageOffset("-1")).toThrow(AppError);
  });
});
