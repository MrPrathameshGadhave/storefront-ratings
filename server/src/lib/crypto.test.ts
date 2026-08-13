import { describe, expect, it } from "vitest";
import { createOtp, hashOtp, verifyOtpHash } from "./crypto.js";

describe("OTP security helpers", () => {
  it("creates a six-digit numeric OTP", () => {
    expect(createOtp()).toMatch(/^\d{6}$/);
  });

  it("verifies only a matching OTP hash", () => {
    const otp = "012345";
    const hash = hashOtp(otp);
    expect(verifyOtpHash(otp, hash)).toBe(true);
    expect(verifyOtpHash("012346", hash)).toBe(false);
  });
});
