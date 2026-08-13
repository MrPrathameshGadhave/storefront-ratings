import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInvitationCode,
  createInvitationToken,
  createOtp,
  getAdminBootstrapExpiry,
  hashInvitationCode,
  hashInvitationToken,
  hashOtp,
  matchesAdminBootstrapToken,
  verifyAdminBootstrapCredentials,
  verifyInvitationCodeHash,
  verifyOtpHash,
} from "./crypto.js";

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

describe("privileged invitation security helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates opaque tokens and unambiguous eight-character registration codes", () => {
    const token = createInvitationToken();
    const code = createInvitationCode();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(hashInvitationToken(token)).not.toBe(token);
    expect(verifyInvitationCodeHash(code, hashInvitationCode(code))).toBe(true);
    expect(verifyInvitationCodeHash("ABCDEFGH", hashInvitationCode("ABCDEFGJ"))).toBe(false);
  });

  it("requires a complete, future-dated server-only first-admin bootstrap configuration", () => {
    const token = "bootstrap-token-for-testing-only-123456";
    const code = "ABCDEFGH";
    const future = new Date(Date.now() + 60_000).toISOString();

    vi.stubEnv("ADMIN_BOOTSTRAP_TOKEN", token);
    vi.stubEnv("ADMIN_BOOTSTRAP_CODE", code);
    vi.stubEnv("ADMIN_BOOTSTRAP_EXPIRES_AT", future);
    expect(matchesAdminBootstrapToken(token)).toBe(true);
    expect(getAdminBootstrapExpiry(token)?.toISOString()).toBe(future);
    expect(verifyAdminBootstrapCredentials(token, code)).toBe(true);
    expect(verifyAdminBootstrapCredentials(token, "ABCDEFGJ")).toBe(false);

    vi.stubEnv("ADMIN_BOOTSTRAP_EXPIRES_AT", new Date(Date.now() - 1_000).toISOString());
    expect(matchesAdminBootstrapToken(token)).toBe(false);
    expect(verifyAdminBootstrapCredentials(token, code)).toBe(false);
  });
});
