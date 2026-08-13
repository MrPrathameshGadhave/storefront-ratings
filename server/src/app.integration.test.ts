/**
 * Real database integration tests for complete API workflows.
 *
 * This suite is deliberately skipped by default. It may run only when both
 * `INTEGRATION_TESTS=true` and `DATABASE_URL` names an isolated test database
 * (for example, `storefront_ratings_test`). Cleanup is scoped to the unique
 * records created by this run; it never truncates or deletes all database rows.
 *
 * Example:
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/storefront_ratings_test?schema=public INTEGRATION_TESTS=true npm test -- --run app.integration.test.ts
 */

import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { hashPassword } from "./lib/crypto.js";
import { prisma } from "./lib/prisma.js";
import { resetRateLimitsForTests } from "./middleware/rate-limit.js";

const emailMock = vi.hoisted(() => {
  const deliveries: { email: string; otp: string }[] = [];
  return {
    deliveries,
    sendVerificationEmail: vi.fn(async (email: string, otp: string) => {
      deliveries.push({ email, otp });
    }),
  };
});

vi.mock("./lib/email.js", () => ({ sendVerificationEmail: emailMock.sendVerificationEmail }));

const namesIsolatedTestDatabase = (databaseUrl: string | undefined): boolean => {
  if (!databaseUrl) return false;

  try {
    const pathname = new URL(databaseUrl).pathname;
    const databaseName = decodeURIComponent(pathname).split("/").filter(Boolean).at(-1) ?? "";
    return /(?:^|[_-])test(?:[_-]|$)/i.test(databaseName);
  } catch {
    return false;
  }
};

const integrationEnabled =
  process.env.INTEGRATION_TESTS === "true" && namesIsolatedTestDatabase(process.env.DATABASE_URL);
const describeIntegration = integrationEnabled ? describe : describe.skip;

const runId = randomUUID().replaceAll("-", "");
const testEmail = (label: string): string => `${label}-${runId}@integration.test`;

const normalUser = {
  name: "Integration Normal User",
  email: testEmail("normal"),
  address: "14 Integration Avenue, Pune, Maharashtra 411001",
  password: "Integration!1",
};
const adminUser = {
  name: "Integration Admin User",
  email: testEmail("admin"),
  address: "15 Integration Avenue, Pune, Maharashtra 411001",
  password: "Integration!1",
};
const ownerUser = {
  name: "Integration Store Owner",
  email: testEmail("owner"),
  address: "16 Integration Avenue, Pune, Maharashtra 411001",
  password: "Integration!1",
};
const testStore = {
  name: "Integration Ratings Store",
  email: testEmail("store"),
  address: "17 Integration Avenue, Pune, Maharashtra 411001",
};

const testUserEmails = [normalUser.email, adminUser.email, ownerUser.email];
const testStoreEmails = [testStore.email];

const cleanupTestData = async (): Promise<void> => {
  await prisma.rating.deleteMany({
    where: {
      OR: [
        { user: { is: { email: { in: testUserEmails } } } },
        { store: { is: { email: { in: testStoreEmails } } } },
      ],
    },
  });
  await prisma.pendingRegistration.deleteMany({ where: { email: { in: testUserEmails } } });
  await prisma.store.deleteMany({ where: { email: { in: testStoreEmails } } });
  await prisma.user.deleteMany({ where: { email: { in: testUserEmails } } });
};

describeIntegration("database integration: user workflows and role boundaries", () => {
  const app = createApp();

  beforeAll(async () => {
    const [adminPasswordHash, ownerPasswordHash] = await Promise.all([
      hashPassword(adminUser.password),
      hashPassword(ownerUser.password),
    ]);
    const { password: _adminPassword, ...adminRecord } = adminUser;
    const { password: _ownerPassword, ...ownerRecord } = ownerUser;
    const [, owner] = await Promise.all([
      prisma.user.create({
        data: {
          ...adminRecord,
          passwordHash: adminPasswordHash,
          role: "ADMIN",
          emailVerified: true,
        },
      }),
      prisma.user.create({
        data: {
          ...ownerRecord,
          passwordHash: ownerPasswordHash,
          role: "STORE_OWNER",
          emailVerified: true,
        },
      }),
    ]);
    await prisma.store.create({ data: { ...testStore, ownerId: owner.id } });
  });

  beforeEach(() => {
    resetRateLimitsForTests();
    emailMock.deliveries.splice(0);
    emailMock.sendVerificationEmail.mockClear();
  });

  afterAll(async () => {
    try {
      await cleanupTestData();
    } finally {
      await prisma.$disconnect();
    }
  });

  it("registers, verifies, logs in, and creates then updates a single rating", async () => {
    const registration = await request(app).post("/api/auth/register").send(normalUser);
    expect(registration.status).toBe(202);
    expect(registration.body.data).toMatchObject({ email: normalUser.email });
    expect(registration.body.data).not.toHaveProperty("otp");

    const delivery = emailMock.deliveries.find((message) => message.email === normalUser.email);
    expect(delivery?.otp).toMatch(/^\d{6}$/);
    if (!delivery) throw new Error("The mocked verification email was not captured.");

    const verification = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: normalUser.email, otp: delivery.otp });
    expect(verification.status).toBe(201);
    expect(verification.body.data.user).toMatchObject({
      email: normalUser.email,
      role: "NORMAL_USER",
      emailVerified: true,
    });

    const normalClient = request.agent(app);
    const login = await normalClient
      .post("/api/auth/login")
      .send({ email: normalUser.email, password: normalUser.password });
    expect(login.status).toBe(200);
    expect(login.headers["set-cookie"]).toBeDefined();

    const stores = await normalClient.get(
      `/api/stores?search=${encodeURIComponent("Integration Ratings")}`,
    );
    expect(stores.status).toBe(200);
    const store = stores.body.data.stores.find(
      (candidate: { email: string }) => candidate.email === testStore.email,
    ) as { id: string; submittedRating: number | null } | undefined;
    expect(store).toMatchObject({ submittedRating: null });
    if (!store) throw new Error("The integration test store was not returned to the normal user.");

    const firstRating = await normalClient.put(`/api/stores/${store.id}/rating`).send({ value: 4 });
    expect(firstRating.status).toBe(200);
    expect(firstRating.body.data).toMatchObject({ averageRating: 4, ratingCount: 1 });

    const updatedRating = await normalClient
      .put(`/api/stores/${store.id}/rating`)
      .send({ value: 5 });
    expect(updatedRating.status).toBe(200);
    expect(updatedRating.body.data).toMatchObject({ averageRating: 5, ratingCount: 1 });

    const persistedRatings = await prisma.rating.findMany({
      where: {
        user: { is: { email: normalUser.email } },
        store: { is: { email: testStore.email } },
      },
      select: { value: true },
    });
    expect(persistedRatings).toEqual([{ value: 5 }]);
  });

  it("allows each privileged role into its own dashboard and blocks cross-role access", async () => {
    const signIn = async (user: typeof adminUser | typeof ownerUser) => {
      const client = request.agent(app);
      const response = await client
        .post("/api/auth/login")
        .send({ email: user.email, password: user.password });
      expect(response.status).toBe(200);
      return client;
    };

    const adminClient = await signIn(adminUser);
    const ownerClient = await signIn(ownerUser);

    const adminDashboard = await adminClient.get("/api/admin/dashboard");
    expect(adminDashboard.status).toBe(200);
    expect(adminDashboard.body.data.userCount).toBeGreaterThanOrEqual(2);

    const ownerDashboard = await ownerClient.get("/api/owner/dashboard");
    expect(ownerDashboard.status).toBe(200);
    expect(ownerDashboard.body.data.store).toMatchObject({ name: testStore.name });
    expect(ownerDashboard.body.data.store.id).toBeDefined();

    const adminBlockedFromOwner = await adminClient.get("/api/owner/dashboard");
    expect(adminBlockedFromOwner.status).toBe(403);
    expect(adminBlockedFromOwner.body.error.code).toBe("FORBIDDEN");

    const ownerBlockedFromAdmin = await ownerClient.get("/api/admin/dashboard");
    expect(ownerBlockedFromAdmin.status).toBe(403);
    expect(ownerBlockedFromAdmin.body.error.code).toBe("FORBIDDEN");
  });
});
