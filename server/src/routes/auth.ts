import { Prisma } from "@prisma/client";
import { Router } from "express";
import { env } from "../config/env.js";
import { auditLog } from "../lib/audit.js";
import { AppError } from "../lib/app-error.js";
import {
  createOtp,
  getAdminBootstrapExpiry,
  hashInvitationToken,
  hashOtp,
  hashPassword,
  matchesAdminBootstrapToken,
  verifyAdminBootstrapCredentials,
  verifyInvitationCodeHash,
  verifyOtpHash,
  verifyPassword,
} from "../lib/crypto.js";
import { sendVerificationEmail } from "../lib/email.js";
import { prisma } from "../lib/prisma.js";
import { signSession } from "../lib/token.js";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rate-limit.js";
import { validateBody } from "../middleware/validate.js";
import {
  loginSchema,
  otpSchema,
  passwordChangeSchema,
  privilegedInvitationRegistrationSchema,
  registrationSchema,
  resendSchema,
} from "../schemas/account.js";

const TEN_MINUTES = 10 * 60 * 1000;
const RESEND_COOLDOWN = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_INVITATION_CODE_ATTEMPTS = 5;
const CONFIDENTIAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax" as const,
  maxAge: 8 * 60 * 60 * 1000,
  path: "/",
});

const toPublicUser = (user: {
  id: string;
  name: string;
  email: string;
  address: string;
  role: string;
  emailVerified: boolean;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  address: user.address,
  role: user.role,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
});

const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
};

const confidentialTokenFromRequest = (token: unknown): string => {
  if (typeof token !== "string" || !CONFIDENTIAL_TOKEN_PATTERN.test(token)) {
    throw new AppError(
      404,
      "INVITATION_NOT_AVAILABLE",
      "This registration invitation is not available.",
    );
  }
  return token;
};

const invitationNotAvailable = (): AppError =>
  new AppError(404, "INVITATION_NOT_AVAILABLE", "This registration invitation is not available.");

type PrivilegedRegistrationInput = {
  code: string;
  name: string;
  address: string;
  password: string;
  email?: string;
};

export const authRouter = Router();

authRouter.post(
  "/register",
  createRateLimit(15 * 60 * 1000, 5),
  validateBody(registrationSchema),
  async (req, res, next) => {
    try {
      const input = req.body as { name: string; email: string; address: string; password: string };
      const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
      if (existingUser) {
        throw new AppError(
          409,
          "EMAIL_UNAVAILABLE",
          "Unable to start registration with those details.",
        );
      }

      const existingPending = await prisma.pendingRegistration.findUnique({
        where: { email: input.email },
      });
      if (existingPending && existingPending.lastSentAt.getTime() + RESEND_COOLDOWN > Date.now()) {
        throw new AppError(
          429,
          "RESEND_COOLDOWN",
          "Please wait before requesting another verification code.",
          {
            resendAvailableAt: new Date(
              existingPending.lastSentAt.getTime() + RESEND_COOLDOWN,
            ).toISOString(),
          },
        );
      }

      const passwordHash = await hashPassword(input.password);
      const otp = createOtp();
      const expiresAt = new Date(Date.now() + TEN_MINUTES);
      const lastSentAt = new Date();
      const pending = await prisma.pendingRegistration.upsert({
        where: { email: input.email },
        create: {
          name: input.name,
          email: input.email,
          address: input.address,
          passwordHash,
          otpHash: hashOtp(otp),
          expiresAt,
          attempts: 0,
          lastSentAt,
          otpRequestCount: 1,
        },
        update: {
          name: input.name,
          address: input.address,
          passwordHash,
          otpHash: hashOtp(otp),
          expiresAt,
          attempts: 0,
          lastSentAt,
          otpRequestCount: { increment: 1 },
          usedAt: null,
        },
      });
      try {
        await sendVerificationEmail(input.email, otp);
      } catch (emailError) {
        // Clean up the pending registration if email fails
        try {
          await prisma.pendingRegistration.deleteMany({
            where: { id: pending.id, otpHash: hashOtp(otp) },
          });
        } catch {
          // Ignore cleanup errors, re-throw the email error
        }
        throw emailError;
      }

      res.status(202).json({
        data: {
          email: input.email,
          maskedEmail: maskEmail(input.email),
          resendAvailableAt: new Date(lastSentAt.getTime() + RESEND_COOLDOWN),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.get(
  "/invitations/:token",
  createRateLimit(15 * 60 * 1000, 20),
  async (req, res, next) => {
    try {
      const token = confidentialTokenFromRequest(req.params.token);
      const invitation = await prisma.privilegedInvitation.findUnique({
        where: { tokenHash: hashInvitationToken(token) },
        select: { email: true, role: true, expiresAt: true, usedAt: true },
      });
      if (invitation) {
        if (invitation.usedAt) throw invitationNotAvailable();
        if (invitation.expiresAt <= new Date()) {
          throw new AppError(
            410,
            "INVITATION_EXPIRED",
            "This registration invitation has expired. Ask an administrator for a new one.",
          );
        }
        if (invitation.role !== "ADMIN" && invitation.role !== "STORE_OWNER") {
          throw invitationNotAvailable();
        }
        res.json({
          data: {
            role: invitation.role,
            maskedEmail: maskEmail(invitation.email),
            expiresAt: invitation.expiresAt,
            requiresEmail: false,
          },
        });
        return;
      }

      // The first administrator is bootstrapped with two environment-only
      // secrets. It is intentionally available only while the platform has no
      // administrator, and it never discloses an email address.
      const bootstrapExpiry = getAdminBootstrapExpiry(token);
      if (bootstrapExpiry) {
        const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
        if (adminCount === 0) {
          res.json({
            data: { role: "ADMIN", expiresAt: bootstrapExpiry, requiresEmail: true },
          });
          return;
        }
      }
      throw invitationNotAvailable();
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/invitations/:token/register",
  createRateLimit(15 * 60 * 1000, 10),
  validateBody(privilegedInvitationRegistrationSchema),
  async (req, res, next) => {
    try {
      const token = confidentialTokenFromRequest(req.params.token);
      const input = req.body as PrivilegedRegistrationInput;
      const tokenHash = hashInvitationToken(token);
      const storedInvitation = await prisma.privilegedInvitation.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          email: true,
          role: true,
          codeHash: true,
          expiresAt: true,
          usedAt: true,
          attempts: true,
        },
      });

      if (storedInvitation) {
        const now = new Date();
        const redemption = await prisma.$transaction(
          async (transaction) => {
            const invitation = await transaction.privilegedInvitation.findUnique({
              where: { tokenHash },
            });
            if (!invitation || invitation.usedAt) throw invitationNotAvailable();
            if (invitation.expiresAt <= now) {
              throw new AppError(
                410,
                "INVITATION_EXPIRED",
                "This registration invitation has expired. Ask an administrator for a new one.",
              );
            }
            if (invitation.role !== "ADMIN" && invitation.role !== "STORE_OWNER") {
              throw invitationNotAvailable();
            }
            if (invitation.attempts >= MAX_INVITATION_CODE_ATTEMPTS) {
              return { kind: "attempts-exceeded" as const };
            }
            if (!verifyInvitationCodeHash(input.code, invitation.codeHash)) {
              // Return a sentinel instead of throwing so this increment is
              // committed by the interactive transaction. Throwing would roll
              // it back and allow unlimited guesses.
              await transaction.privilegedInvitation.update({
                where: { id: invitation.id },
                data: { attempts: { increment: 1 } },
              });
              return { kind: "invalid-code" as const };
            }

            const existingUser = await transaction.user.findUnique({
              where: { email: invitation.email },
              select: { id: true },
            });
            if (existingUser) {
              throw new AppError(
                409,
                "EMAIL_UNAVAILABLE",
                "An account already uses this email address.",
              );
            }

            // Conditional consumption makes the token single-use even when two
            // requests race. If this update cannot claim it, the transaction
            // cannot create the privileged account.
            const consumed = await transaction.privilegedInvitation.updateMany({
              where: {
                id: invitation.id,
                usedAt: null,
                expiresAt: { gt: now },
                attempts: { lt: MAX_INVITATION_CODE_ATTEMPTS },
              },
              data: { usedAt: now },
            });
            if (consumed.count !== 1) {
              throw new AppError(
                409,
                "INVITATION_CONFLICT",
                "This invitation was just used. Sign in or ask an administrator for a new invitation.",
              );
            }

            const user = await transaction.user.create({
              data: {
                name: input.name,
                email: invitation.email,
                address: input.address,
                passwordHash: await hashPassword(input.password),
                role: invitation.role,
                emailVerified: true,
              },
            });
            return { kind: "created" as const, invitationId: invitation.id, user };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        if (redemption.kind === "attempts-exceeded") {
          throw new AppError(
            429,
            "INVITATION_CODE_ATTEMPTS_EXCEEDED",
            "Too many incorrect invitation-code attempts. Ask an administrator for a new invitation.",
          );
        }
        if (redemption.kind === "invalid-code") {
          throw new AppError(400, "INVITATION_CODE_INVALID", "The invitation code is incorrect.");
        }
        const { user } = redemption;
        auditLog({
          action: "PRIVILEGED_INVITATION_REDEEMED",
          actorId: user.id,
          actorRole: user.role,
          resourceType: "INVITATION",
          resourceId: redemption.invitationId,
          changes: { role: user.role },
          status: "SUCCESS",
        });
        res.status(201).json({ data: { user: toPublicUser(user) } });
        return;
      }

      if (!matchesAdminBootstrapToken(token)) throw invitationNotAvailable();
      if (!input.email) {
        throw new AppError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
          email: "Email is required for the first administrator.",
        });
      }

      const bootstrapUser = await prisma.$transaction(
        async (transaction) => {
          const adminCount = await transaction.user.count({ where: { role: "ADMIN" } });
          if (adminCount > 0 || !verifyAdminBootstrapCredentials(token, input.code)) {
            throw invitationNotAvailable();
          }
          const existingUser = await transaction.user.findUnique({
            where: { email: input.email! },
            select: { id: true },
          });
          if (existingUser) {
            throw new AppError(
              409,
              "EMAIL_UNAVAILABLE",
              "An account already uses this email address.",
            );
          }
          return transaction.user.create({
            data: {
              name: input.name,
              email: input.email!,
              address: input.address,
              passwordHash: await hashPassword(input.password),
              role: "ADMIN",
              emailVerified: true,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      auditLog({
        action: "PRIVILEGED_INVITATION_REDEEMED",
        actorId: bootstrapUser.id,
        actorRole: "ADMIN",
        resourceType: "USER",
        resourceId: bootstrapUser.id,
        changes: { bootstrap: true, role: "ADMIN" },
        status: "SUCCESS",
      });
      res.status(201).json({ data: { user: toPublicUser(bootstrapUser) } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        next(
          new AppError(
            409,
            "INVITATION_CONFLICT",
            "This invitation was just used. Sign in or ask an administrator for a new invitation.",
          ),
        );
        return;
      }
      next(error);
    }
  },
);

authRouter.post(
  "/verify-email",
  createRateLimit(15 * 60 * 1000, 12),
  validateBody(otpSchema),
  async (req, res, next) => {
    try {
      const { email, otp } = req.body as { email: string; otp: string };
      const now = new Date();
      const user = await prisma.$transaction(
        async (transaction) => {
          const pending = await transaction.pendingRegistration.findUnique({ where: { email } });
          if (!pending || pending.usedAt) {
            throw new AppError(
              400,
              "OTP_INVALID",
              "This verification code is invalid or has already been used.",
            );
          }
          if (pending.expiresAt <= now) {
            await transaction.pendingRegistration.delete({ where: { id: pending.id } });
            throw new AppError(
              400,
              "OTP_EXPIRED",
              "This verification code has expired. Request a new one.",
            );
          }
          if (pending.attempts >= MAX_OTP_ATTEMPTS) {
            throw new AppError(
              429,
              "OTP_ATTEMPTS_EXCEEDED",
              "Too many incorrect attempts. Request a new verification code.",
            );
          }
          if (!verifyOtpHash(otp, pending.otpHash)) {
            await transaction.pendingRegistration.update({
              where: { id: pending.id },
              data: { attempts: { increment: 1 } },
            });
            throw new AppError(400, "OTP_INVALID", "The verification code is incorrect.");
          }

          const existing = await transaction.user.findUnique({ where: { email } });
          if (existing) {
            throw new AppError(409, "EMAIL_UNAVAILABLE", "Unable to verify this registration.");
          }
          const verifiedUser = await transaction.user.create({
            data: {
              name: pending.name,
              email: pending.email,
              address: pending.address,
              passwordHash: pending.passwordHash,
              role: "NORMAL_USER",
              emailVerified: true,
            },
          });
          await transaction.pendingRegistration.delete({ where: { id: pending.id } });
          return verifiedUser;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      res.status(201).json({ data: { user: toPublicUser(user) } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        next(new AppError(409, "VERIFICATION_CONFLICT", "Please submit the code once more."));
        return;
      }
      next(error);
    }
  },
);

authRouter.post(
  "/resend-verification",
  createRateLimit(15 * 60 * 1000, 5),
  validateBody(resendSchema),
  async (req, res, next) => {
    try {
      const { email } = req.body as { email: string };
      const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
      if (!pending || pending.usedAt) {
        res.status(202).json({
          data: { message: "If an unverified registration exists, a new code will be sent." },
        });
        return;
      }
      const now = Date.now();
      const resendAt = pending.lastSentAt.getTime() + RESEND_COOLDOWN;
      if (resendAt > now) {
        throw new AppError(
          429,
          "RESEND_COOLDOWN",
          "Please wait before requesting another verification code.",
          { resendAvailableAt: new Date(resendAt).toISOString() },
        );
      }

      const otp = createOtp();
      const lastSentAt = new Date();
      await prisma.pendingRegistration.update({
        where: { id: pending.id },
        data: {
          otpHash: hashOtp(otp),
          expiresAt: new Date(lastSentAt.getTime() + TEN_MINUTES),
          attempts: 0,
          lastSentAt,
          otpRequestCount: { increment: 1 },
          usedAt: null,
        },
      });
      try {
        await sendVerificationEmail(email, otp);
      } catch (error) {
        await prisma.pendingRegistration.updateMany({
          where: { id: pending.id, otpHash: hashOtp(otp) },
          data: {
            otpHash: pending.otpHash,
            expiresAt: pending.expiresAt,
            attempts: pending.attempts,
            lastSentAt: pending.lastSentAt,
            otpRequestCount: pending.otpRequestCount,
          },
        });
        throw error;
      }
      res.status(202).json({
        data: {
          message: "A new verification code has been sent.",
          resendAvailableAt: new Date(lastSentAt.getTime() + RESEND_COOLDOWN),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/login",
  createRateLimit(15 * 60 * 1000, 10),
  validateBody(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const user = await prisma.user.findUnique({ where: { email } });
      const validPassword = user ? await verifyPassword(password, user.passwordHash) : false;
      if (!user || !validPassword) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      }
      if (!user.emailVerified) {
        throw new AppError(403, "EMAIL_UNVERIFIED", "Verify your email before signing in.");
      }
      res.cookie("session", signSession({ sub: user.id, role: user.role }), cookieOptions());
      res.json({ data: { user: toPublicUser(user) } });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post("/logout", (req, res) => {
  res.clearCookie("session", { ...cookieOptions(), maxAge: undefined });
  res.status(204).send();
});

authRouter.get("/me", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id } });
    res.json({ data: { user: toPublicUser(user) } });
  } catch (error) {
    next(error);
  }
});

authRouter.patch(
  "/password",
  authenticate,
  createRateLimit(15 * 60 * 1000, 8),
  validateBody(passwordChangeSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.auth!.id },
        select: { passwordHash: true },
      });
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        throw new AppError(400, "CURRENT_PASSWORD_INVALID", "Your current password is incorrect.");
      }
      await prisma.user.update({
        where: { id: req.auth!.id },
        data: { passwordHash: await hashPassword(newPassword) },
      });
      res.json({ data: { message: "Your password has been updated." } });
    } catch (error) {
      next(error);
    }
  },
);
