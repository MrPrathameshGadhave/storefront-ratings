import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashInvitationCode, hashInvitationToken, hashOtp } from "./lib/crypto.js";
import { signSession } from "./lib/token.js";
import { resetRateLimitsForTests } from "./middleware/rate-limit.js";

const mocks = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    store: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    rating: {
      upsert: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    pendingRegistration: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    privilegedInvitation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

vi.mock("./lib/prisma.js", () => ({ prisma: mocks.prisma }));
vi.mock("./lib/email.js", () => ({ sendVerificationEmail: mocks.sendVerificationEmail }));

const { createApp } = await import("./app.js");

type RequestOptions = {
  method?: string;
  body?: unknown;
  cookie?: string;
};

const callApi = async (path: string, options: RequestOptions = {}): Promise<Response> => {
  const server = createApp().listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } finally {
    server.close();
  }
};

const validRegistration = {
  name: "Alexandra Morgan Registered",
  email: "person@example.com",
  address: "14 Market Street, Pune, Maharashtra 411001",
  password: "ValidPass!1",
};

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitsForTests();
  mocks.sendVerificationEmail.mockResolvedValue(undefined);
  mocks.prisma.pendingRegistration.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.pendingRegistration.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("API contract and security", () => {
  it("starts an OTP registration without returning or persisting the plaintext OTP", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.pendingRegistration.upsert.mockResolvedValue({ id: "pending-registration" });

    const response = await callApi("/api/auth/register", {
      method: "POST",
      body: validRegistration,
    });
    const payload = (await response.json()) as { data: { email: string; maskedEmail: string } };

    expect(response.status).toBe(202);
    expect(payload.data).toMatchObject({
      email: validRegistration.email,
      maskedEmail: "pe****@example.com",
    });
    expect(JSON.stringify(payload)).not.toMatch(/\d{6}/);
    expect(mocks.sendVerificationEmail).toHaveBeenCalledOnce();
    const sentOtp = mocks.sendVerificationEmail.mock.calls[0]?.[1];
    expect(sentOtp).toMatch(/^\d{6}$/);
    const upsertInput = mocks.prisma.pendingRegistration.upsert.mock.calls[0]?.[0] as {
      create: { otpHash: string };
    };
    expect(upsertInput.create.otpHash).not.toBe(sentOtp);
  });

  it("enforces the registration resend cooldown before generating another OTP", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.pendingRegistration.findUnique.mockResolvedValue({
      id: "pending-registration",
      lastSentAt: new Date(),
    });

    const response = await callApi("/api/auth/register", {
      method: "POST",
      body: validRegistration,
    });
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe("RESEND_COOLDOWN");
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
    expect(mocks.prisma.pendingRegistration.upsert).not.toHaveBeenCalled();
  });

  it("returns a clear service-unavailable response when registration cannot reach PostgreSQL", async () => {
    mocks.prisma.user.findUnique.mockRejectedValue(
      new Prisma.PrismaClientInitializationError("Database host is unreachable.", "6.6.0", "P1001"),
    );

    const response = await callApi("/api/auth/register", {
      method: "POST",
      body: validRegistration,
    });
    const payload = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(503);
    expect(payload.error).toEqual({
      code: "DATABASE_UNAVAILABLE",
      message: "The service database is temporarily unavailable. Please try again shortly.",
    });
  });

  it("creates a verified normal-user account only after a correct OTP", async () => {
    const pending = {
      id: "pending-registration",
      name: validRegistration.name,
      email: validRegistration.email,
      address: validRegistration.address,
      passwordHash: "hashed-password",
      otpHash: hashOtp("111111"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      usedAt: null,
    };
    const createdUser = {
      id: "new-user",
      name: pending.name,
      email: pending.email,
      address: pending.address,
      role: "NORMAL_USER",
      emailVerified: true,
      createdAt: new Date("2026-08-12T12:00:00.000Z"),
    };
    const transaction = {
      pendingRegistration: {
        findUnique: vi.fn().mockResolvedValue(pending),
        update: vi.fn(),
        delete: vi.fn().mockResolvedValue(pending),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(createdUser),
      },
    };
    mocks.prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function")
        throw new Error("Expected interactive transaction callback.");
      return callback(transaction);
    });

    const response = await callApi("/api/auth/verify-email", {
      method: "POST",
      body: { email: validRegistration.email, otp: "111111" },
    });
    const payload = (await response.json()) as {
      data: { user: { role: string; emailVerified: boolean } };
    };

    expect(response.status).toBe(201);
    expect(payload.data.user).toMatchObject({ role: "NORMAL_USER", emailVerified: true });
    expect(transaction.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "NORMAL_USER", emailVerified: true }),
    });
    expect(transaction.pendingRegistration.delete).toHaveBeenCalledWith({
      where: { id: pending.id },
    });
  });

  it("rejects an incorrect OTP and increments the persisted attempt counter", async () => {
    const pending = {
      id: "pending-registration",
      email: validRegistration.email,
      otpHash: hashOtp("111111"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      usedAt: null,
    };
    const transaction = {
      pendingRegistration: {
        findUnique: vi.fn().mockResolvedValue(pending),
        update: vi.fn().mockResolvedValue(pending),
        delete: vi.fn(),
      },
      user: { findUnique: vi.fn(), create: vi.fn() },
    };
    mocks.prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function")
        throw new Error("Expected interactive transaction callback.");
      return callback(transaction);
    });

    const response = await callApi("/api/auth/verify-email", {
      method: "POST",
      body: { email: validRegistration.email, otp: "222222" },
    });
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("OTP_INVALID");
    expect(transaction.pendingRegistration.update).toHaveBeenCalledWith({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
  });

  it("rejects an expired OTP and deletes the stale registration", async () => {
    const pending = {
      id: "expired-registration",
      email: validRegistration.email,
      otpHash: hashOtp("111111"),
      expiresAt: new Date(Date.now() - 1_000),
      attempts: 0,
      usedAt: null,
    };
    const transaction = {
      pendingRegistration: {
        findUnique: vi.fn().mockResolvedValue(pending),
        update: vi.fn(),
        delete: vi.fn().mockResolvedValue(pending),
      },
      user: { findUnique: vi.fn(), create: vi.fn() },
    };
    mocks.prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function")
        throw new Error("Expected interactive transaction callback.");
      return callback(transaction);
    });

    const response = await callApi("/api/auth/verify-email", {
      method: "POST",
      body: { email: validRegistration.email, otp: "111111" },
    });
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("OTP_EXPIRED");
    expect(transaction.pendingRegistration.delete).toHaveBeenCalledWith({
      where: { id: pending.id },
    });
  });

  it("locks verification after five incorrect attempts", async () => {
    const pending = {
      id: "locked-registration",
      email: validRegistration.email,
      otpHash: hashOtp("111111"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 5,
      usedAt: null,
    };
    const transaction = {
      pendingRegistration: {
        findUnique: vi.fn().mockResolvedValue(pending),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: { findUnique: vi.fn(), create: vi.fn() },
    };
    mocks.prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function")
        throw new Error("Expected interactive transaction callback.");
      return callback(transaction);
    });

    const response = await callApi("/api/auth/verify-email", {
      method: "POST",
      body: { email: validRegistration.email, otp: "111111" },
    });
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe("OTP_ATTEMPTS_EXCEEDED");
    expect(transaction.pendingRegistration.update).not.toHaveBeenCalled();
  });

  it("rejects an OTP resend during the 60-second cooldown", async () => {
    mocks.prisma.pendingRegistration.findUnique.mockResolvedValue({
      id: "pending-registration",
      email: validRegistration.email,
      usedAt: null,
      lastSentAt: new Date(),
    });

    const response = await callApi("/api/auth/resend-verification", {
      method: "POST",
      body: { email: validRegistration.email },
    });
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe("RESEND_COOLDOWN");
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("blocks a normal user from administrator endpoints", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "member-id",
      role: "NORMAL_USER",
      emailVerified: true,
    });
    const cookie = `session=${signSession({ sub: "member-id", role: "NORMAL_USER" })}`;
    const response = await callApi("/api/admin/dashboard", { cookie });
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("lets an administrator create a return-once, email-bound privileged invitation", async () => {
    const admin = { id: "admin-id", role: "ADMIN", emailVerified: true };
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    mocks.prisma.user.findUnique.mockResolvedValueOnce(admin).mockResolvedValueOnce(null);
    mocks.prisma.privilegedInvitation.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.privilegedInvitation.create.mockResolvedValue({
      id: "invitation-id",
      email: "owner@example.com",
      role: "STORE_OWNER",
      expiresAt,
    });
    const cookie = `session=${signSession({ sub: admin.id, role: "ADMIN" })}`;

    const response = await callApi("/api/admin/invitations", {
      method: "POST",
      cookie,
      body: { email: "owner@example.com", role: "STORE_OWNER" },
    });
    const payload = (await response.json()) as {
      data: { token: string; code: string; role: string; email: string };
    };

    expect(response.status).toBe(201);
    expect(payload.data).toMatchObject({ email: "owner@example.com", role: "STORE_OWNER" });
    expect(payload.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(payload.data.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    const createInput = mocks.prisma.privilegedInvitation.create.mock.calls[0]?.[0] as {
      data: { tokenHash: string; codeHash: string };
    };
    expect(createInput.data.tokenHash).not.toBe(payload.data.token);
    expect(createInput.data.codeHash).not.toBe(payload.data.code);
  });

  it("returns only masked invitation details from a confidential registration token", async () => {
    const token = "a".repeat(43);
    mocks.prisma.privilegedInvitation.findUnique.mockResolvedValue({
      email: "owner@example.com",
      role: "STORE_OWNER",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    const response = await callApi(`/api/auth/invitations/${token}`);
    const payload = (await response.json()) as {
      data: { role: string; maskedEmail?: string; requiresEmail: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      role: "STORE_OWNER",
      maskedEmail: "ow***@example.com",
      expiresAt: expect.any(String),
      requiresEmail: false,
    });
    expect(JSON.stringify(payload)).not.toContain("owner@example.com");
    expect(mocks.prisma.privilegedInvitation.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashInvitationToken(token) },
      select: { email: true, role: true, expiresAt: true, usedAt: true },
    });
  });

  it("persists an incorrect invitation-code attempt before returning the error", async () => {
    const token = "b".repeat(43);
    const invitation = {
      id: "invitation-id",
      email: "owner@example.com",
      role: "STORE_OWNER",
      codeHash: hashInvitationCode("ABCDEFGH"),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      attempts: 0,
    };
    const transaction = {
      privilegedInvitation: {
        findUnique: vi.fn().mockResolvedValue(invitation),
        update: vi.fn().mockResolvedValue(invitation),
        updateMany: vi.fn(),
      },
      user: { findUnique: vi.fn(), create: vi.fn() },
    };
    mocks.prisma.privilegedInvitation.findUnique.mockResolvedValue(invitation);
    mocks.prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function")
        throw new Error("Expected interactive transaction callback.");
      return callback(transaction);
    });

    const response = await callApi(`/api/auth/invitations/${token}/register`, {
      method: "POST",
      body: { ...validRegistration, code: "ABCDEFGJ" },
    });
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVITATION_CODE_INVALID");
    expect(transaction.privilegedInvitation.update).toHaveBeenCalledWith({
      where: { id: invitation.id },
      data: { attempts: { increment: 1 } },
    });
  });

  it("creates only the email-bound, server-derived role when an invitation is redeemed", async () => {
    const token = "c".repeat(43);
    const invitation = {
      id: "invitation-id",
      email: "owner@example.com",
      role: "STORE_OWNER",
      codeHash: hashInvitationCode("ABCDEFGH"),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      attempts: 0,
    };
    const createdUser = {
      id: "owner-id",
      name: validRegistration.name,
      email: invitation.email,
      address: validRegistration.address,
      role: "STORE_OWNER",
      emailVerified: true,
      createdAt: new Date("2026-08-14T00:00:00.000Z"),
    };
    const transaction = {
      privilegedInvitation: {
        findUnique: vi.fn().mockResolvedValue(invitation),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(createdUser),
      },
    };
    mocks.prisma.privilegedInvitation.findUnique.mockResolvedValue(invitation);
    mocks.prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function")
        throw new Error("Expected interactive transaction callback.");
      return callback(transaction);
    });

    const response = await callApi(`/api/auth/invitations/${token}/register`, {
      method: "POST",
      body: {
        ...validRegistration,
        email: "attacker@example.com",
        role: "ADMIN",
        code: "ABCDEFGH",
      },
    });
    const payload = (await response.json()) as { data: { user: { email: string; role: string } } };

    expect(response.status).toBe(201);
    expect(payload.data.user).toMatchObject({ email: invitation.email, role: invitation.role });
    expect(transaction.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: invitation.email,
        role: invitation.role,
        emailVerified: true,
      }),
    });
  });

  it("allows only a verified normal user to create or update a 1-5 rating", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "member-id",
      role: "NORMAL_USER",
      emailVerified: true,
    });
    mocks.prisma.store.findUnique.mockResolvedValue({ id: "store-id" });
    mocks.prisma.rating.upsert.mockResolvedValue({
      id: "rating-id",
      value: 5,
      updatedAt: new Date("2026-08-12T12:00:00.000Z"),
    });
    mocks.prisma.rating.aggregate.mockResolvedValue({ _avg: { value: 5 }, _count: 1 });
    const cookie = `session=${signSession({ sub: "member-id", role: "NORMAL_USER" })}`;

    const response = await callApi("/api/stores/store-id/rating", {
      method: "PUT",
      cookie,
      body: { value: 5 },
    });
    const payload = (await response.json()) as {
      data: { rating: { value: number }; averageRating: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data.rating.value).toBe(5);
    expect(payload.data.averageRating).toBe(5);
    expect(mocks.prisma.rating.upsert).toHaveBeenCalledWith({
      where: { userId_storeId: { userId: "member-id", storeId: "store-id" } },
      create: { userId: "member-id", storeId: "store-id", value: 5 },
      update: { value: 5 },
    });
  });

  it("blocks rating access without a session", async () => {
    const response = await callApi("/api/stores/store-id/rating", {
      method: "PUT",
      body: { value: 4 },
    });
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHENTICATED");
  });
});
