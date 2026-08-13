-- Privileged registrations are accepted only through an administrator-created,
-- single-use invitation. The raw link token and registration code are never
-- persisted; only HMAC digests are stored.
CREATE TABLE "PrivilegedInvitation" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "Role" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivilegedInvitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PrivilegedInvitation_role_check" CHECK ("role" IN ('ADMIN', 'STORE_OWNER'))
);

CREATE UNIQUE INDEX "PrivilegedInvitation_tokenHash_key" ON "PrivilegedInvitation"("tokenHash");
CREATE INDEX "PrivilegedInvitation_email_idx" ON "PrivilegedInvitation"("email");
CREATE INDEX "PrivilegedInvitation_expiresAt_idx" ON "PrivilegedInvitation"("expiresAt");
CREATE INDEX "PrivilegedInvitation_createdById_idx" ON "PrivilegedInvitation"("createdById");

ALTER TABLE "PrivilegedInvitation"
  ADD CONSTRAINT "PrivilegedInvitation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
