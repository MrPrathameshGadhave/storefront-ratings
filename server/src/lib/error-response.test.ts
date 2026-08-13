import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createDetailedErrorResponse,
  formatErrorForLogging,
  mapZodErrors,
  sanitizeErrorForClient,
  validateWithDetails,
} from "./error-response";

describe("Error response utilities", () => {
  describe("mapZodErrors", () => {
    it("should map single field error", () => {
      const schema = z.object({ email: z.string().email() });
      try {
        schema.parse({ email: "invalid" });
      } catch (error) {
        const result = mapZodErrors(error as z.ZodError);
        expect(result.email).toBeTruthy();
        expect(result.email).toContain("email");
      }
    });

    it("should map multiple field errors", () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
      });
      try {
        schema.parse({ email: "invalid", password: "short" });
      } catch (error) {
        const result = mapZodErrors(error as z.ZodError);
        expect(result.email).toBeTruthy();
        expect(result.password).toBeTruthy();
      }
    });

    it("should map nested field errors", () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(3),
          }),
        }),
      });
      try {
        schema.parse({ user: { profile: { name: "ab" } } });
      } catch (error) {
        const result = mapZodErrors(error as z.ZodError);
        expect(result["user.profile.name"]).toBeTruthy();
      }
    });
  });

  describe("createDetailedErrorResponse", () => {
    it("should create response with all fields", () => {
      const response = createDetailedErrorResponse(
        "TEST_ERROR",
        "Test message",
        { field: "error" },
        "/api/test",
      );

      expect(response.error.code).toBe("TEST_ERROR");
      expect(response.error.message).toBe("Test message");
      expect(response.error.fields).toEqual({ field: "error" });
      expect(response.error.details?.path).toBe("/api/test");
      expect(response.error.details?.timestamp).toBeTruthy();
    });

    it("should omit empty fields object", () => {
      const response = createDetailedErrorResponse("TEST_ERROR", "Test message", {});

      expect(response.error.fields).toBeUndefined();
    });

    it("should omit path if not provided", () => {
      const response = createDetailedErrorResponse("TEST_ERROR", "Test message");

      expect(response.error.details?.path).toBeUndefined();
      expect(response.error.details?.timestamp).toBeTruthy();
    });
  });

  describe("validateWithDetails", () => {
    it("should return validated data on success", () => {
      const schema = z.object({ name: z.string() });
      const result = validateWithDetails(schema, { name: "John" });

      expect(result).toEqual({ name: "John" });
    });

    it("should throw error with fields on validation failure", () => {
      const schema = z.object({ email: z.string().email() });

      expect(() => {
        validateWithDetails(schema, { email: "invalid" });
      }).toThrow();
    });
  });

  describe("formatErrorForLogging", () => {
    it("should format Error object", () => {
      const error = new Error("Test error");
      const result = formatErrorForLogging(error, { endpoint: "/test" });

      expect(result.name).toBe("Error");
      expect(result.message).toBe("Test error");
      expect(result.endpoint).toBe("/test");
    });

    it("should include stack in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const error = new Error("Test error");
      const result = formatErrorForLogging(error);

      expect(result.stack).toBeTruthy();

      process.env.NODE_ENV = originalEnv;
    });

    it("should exclude stack in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const error = new Error("Test error");
      const result = formatErrorForLogging(error);

      expect(result.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it("should handle non-Error objects", () => {
      const result = formatErrorForLogging("string error");

      expect(result.message).toBe("string error");
      expect(result.name).toBe("string");
    });
  });

  describe("sanitizeErrorForClient", () => {
    it("should return error message for Error objects", () => {
      const error = new Error("Something went wrong");
      const result = sanitizeErrorForClient(error);

      expect(result).toBe("Something went wrong");
    });

    it("should remove file paths from error message", () => {
      const error = new Error("Error at /home/user/app/server/src/config.ts");
      const result = sanitizeErrorForClient(error);

      expect(result).not.toContain("/home/user/app");
      expect(result).toContain("[internal]");
    });

    it("should return default message for non-Error objects", () => {
      const result = sanitizeErrorForClient(123, "Custom default");

      expect(result).toBe("Custom default");
    });
  });
});
