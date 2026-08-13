import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  normalizeEmail,
  sanitizeForDisplay,
  sanitizeText,
  validateAddress,
  validateName,
  validatePassword,
} from "./sanitize";

describe("Sanitization utilities", () => {
  describe("escapeHtml", () => {
    it("should escape HTML special characters", () => {
      expect(escapeHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;",
      );
    });

    it("should escape ampersands", () => {
      expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    });

    it("should not escape already safe text", () => {
      expect(escapeHtml("Hello World")).toBe("Hello World");
    });

    it("should escape all dangerous characters", () => {
      expect(escapeHtml('<div class="danger">Test</div>')).toBe(
        "&lt;div class=&quot;danger&quot;&gt;Test&lt;&#x2F;div&gt;",
      );
    });
  });

  describe("sanitizeText", () => {
    it("should remove HTML tags", () => {
      expect(sanitizeText("<p>Hello</p> <strong>World</strong>")).toBe("Hello World");
    });

    it("should handle nested tags", () => {
      expect(sanitizeText("<div><p>Nested</p></div>")).toBe("Nested");
    });

    it("should handle script tags", () => {
      expect(sanitizeText("<p>Hello <script>alert('xss')</script>World</p>")).toBe("Hello World");
    });

    it("should preserve text content", () => {
      expect(sanitizeText("<h1>Important!</h1>")).toBe("Important!");
    });
  });

  describe("normalizeEmail", () => {
    it("should lowercase email", () => {
      expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
    });

    it("should trim whitespace", () => {
      expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
    });

    it("should reject invalid emails", () => {
      expect(() => normalizeEmail("invalid-email")).toThrow("Invalid email format");
    });

    it("should accept valid emails", () => {
      expect(normalizeEmail("user+tag@sub.example.com")).toBe("user+tag@sub.example.com");
    });
  });

  describe("validatePassword", () => {
    it("should accept valid password", () => {
      const result = validatePassword("ValidPass123!");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject password without uppercase", () => {
      const result = validatePassword("validpass123!");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("uppercase"))).toBe(true);
    });

    it("should reject password without special character", () => {
      const result = validatePassword("ValidPass123");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("special character"))).toBe(true);
    });

    it("should reject password that is too short", () => {
      const result = validatePassword("Short1!");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("8-16"))).toBe(true);
    });

    it("should reject password that is too long", () => {
      const result = validatePassword("VeryLongPassword123!");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("8-16"))).toBe(true);
    });
  });

  describe("sanitizeForDisplay", () => {
    it("should escape HTML and truncate", () => {
      const result = sanitizeForDisplay("<script>alert('xss')</script>", 15);
      expect(result).toContain("...");
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it("should escape HTML without truncating if short", () => {
      const result = sanitizeForDisplay("<b>Test</b>", 100);
      expect(result).toBe("&lt;b&gt;Test&lt;&#x2F;b&gt;");
    });

    it("should use default max length", () => {
      const longText = "A".repeat(150);
      const result = sanitizeForDisplay(longText);
      expect(result).toContain("...");
    });
  });

  describe("validateName", () => {
    it("should accept valid name", () => {
      const result = validateName("This is a valid name");
      expect(result.valid).toBe(true);
    });

    it("should accept exactly 20 characters", () => {
      const result = validateName("A".repeat(20));
      expect(result.valid).toBe(true);
    });

    it("should accept exactly 60 characters", () => {
      const result = validateName("A".repeat(60));
      expect(result.valid).toBe(true);
    });

    it("should reject name shorter than 20 characters", () => {
      const result = validateName("Short");
      expect(result.valid).toBe(false);
      expect(result.message).toContain("20-60");
    });

    it("should reject name longer than 60 characters", () => {
      const result = validateName("A".repeat(61));
      expect(result.valid).toBe(false);
      expect(result.message).toContain("20-60");
    });

    it("should trim whitespace before validating", () => {
      const result = validateName("  " + "A".repeat(20) + "  ");
      expect(result.valid).toBe(true);
    });
  });

  describe("validateAddress", () => {
    it("should accept valid address", () => {
      const result = validateAddress("123 Main Street, New York, NY 10001");
      expect(result.valid).toBe(true);
    });

    it("should reject empty address", () => {
      const result = validateAddress("");
      expect(result.valid).toBe(false);
      expect(result.message).toContain("required");
    });

    it("should reject address longer than 400 characters", () => {
      const result = validateAddress("A".repeat(401));
      expect(result.valid).toBe(false);
      expect(result.message).toContain("400");
    });

    it("should accept exactly 400 characters", () => {
      const result = validateAddress("A".repeat(400));
      expect(result.valid).toBe(true);
    });

    it("should trim whitespace before validating", () => {
      const result = validateAddress("  Valid Address  ");
      expect(result.valid).toBe(true);
    });
  });
});
