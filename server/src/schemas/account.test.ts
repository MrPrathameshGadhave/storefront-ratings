import { describe, expect, it } from "vitest";
import {
  passwordSchema,
  privilegedInvitationRegistrationSchema,
  privilegedInvitationSchema,
  registrationSchema,
  storeSchema,
} from "./account.js";

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

  it("only allows a privileged invitation to request an administrator or store-owner role", () => {
    expect(
      privilegedInvitationSchema.safeParse({ email: "invitee@example.com", role: "ADMIN" }).success,
    ).toBe(true);
    expect(
      privilegedInvitationSchema.safeParse({ email: "invitee@example.com", role: "STORE_OWNER" })
        .success,
    ).toBe(true);
    expect(
      privilegedInvitationSchema.safeParse({ email: "invitee@example.com", role: "NORMAL_USER" })
        .success,
    ).toBe(false);
  });

  it("normalizes the optional bootstrap email and invitation code without accepting ambiguous characters", () => {
    const parsed = privilegedInvitationRegistrationSchema.parse({
      code: "ab2cdefg",
      name: validRegistration.name,
      email: "  FIRST.ADMIN@EXAMPLE.COM ",
      address: validRegistration.address,
      password: validRegistration.password,
    });
    expect(parsed.code).toBe("AB2CDEFG");
    expect(parsed.email).toBe("first.admin@example.com");
    expect(
      privilegedInvitationRegistrationSchema.safeParse({
        ...validRegistration,
        code: "ABCDEFGI",
      }).success,
    ).toBe(false);
  });
});
