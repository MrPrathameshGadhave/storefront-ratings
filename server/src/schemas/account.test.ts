import { describe, expect, it } from "vitest";
import { passwordSchema, registrationSchema, storeSchema } from "./account.js";

const validRegistration = {
  name: "Alexandra Morgan Registered",
  email: "  USER@EXAMPLE.COM ",
  address: "14 Market Street, Pune, Maharashtra 411001",
  password: "ValidPass!1",
};

describe("account validation", () => {
  it("normalizes a valid registration email", () => {
    const parsed = registrationSchema.parse(validRegistration);
    expect(parsed.email).toBe("user@example.com");
  });

  it("enforces the 20–60 character PDF name boundary", () => {
    expect(
      registrationSchema.safeParse({ ...validRegistration, name: "A".repeat(19) }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...validRegistration, name: "A".repeat(20) }).success,
    ).toBe(true);
    expect(
      registrationSchema.safeParse({ ...validRegistration, name: "A".repeat(61) }).success,
    ).toBe(false);
  });

  it("requires an uppercase letter and special character in a password", () => {
    expect(passwordSchema.safeParse("lowercase1!").success).toBe(false);
    expect(passwordSchema.safeParse("Uppercase12").success).toBe(false);
    expect(passwordSchema.safeParse("Uppercase1 ").success).toBe(false);
    expect(passwordSchema.safeParse("ValidPass!1").success).toBe(true);
  });

  it("uses the name restriction for a store name", () => {
    expect(
      storeSchema.safeParse({
        name: "A useful marketplace store",
        email: "store@example.com",
        address: "14 Market Street",
      }).success,
    ).toBe(true);
    expect(
      storeSchema.safeParse({
        name: "Short Store",
        email: "store@example.com",
        address: "14 Market Street",
      }).success,
    ).toBe(false);
  });
});
