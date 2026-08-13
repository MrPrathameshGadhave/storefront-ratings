import { z } from "zod";

const clean = (value: string): string => value.trim();
const normalizedEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);

export const nameSchema = z
  .string()
  .transform(clean)
  .pipe(
    z
      .string()
      .min(20, "Name must be at least 20 characters.")
      .max(60, "Name must be at most 60 characters."),
  );

export const addressSchema = z
  .string()
  .transform(clean)
  .pipe(
    z.string().min(1, "Address is required.").max(400, "Address must be at most 400 characters."),
  );

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(16, "Password must be at most 16 characters.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[^A-Za-z0-9\s]/, "Password must include a special character.");

export const registrationSchema = z.object({
  name: nameSchema,
  email: normalizedEmail,
  address: addressSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(1, "Password is required."),
});

export const otpSchema = z.object({
  email: normalizedEmail,
  otp: z.string().regex(/^\d{6}$/, "Enter the six-digit verification code."),
});

export const resendSchema = z.object({ email: normalizedEmail });

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: passwordSchema,
});

export const adminUserSchema = registrationSchema.extend({
  role: z.enum(["ADMIN", "NORMAL_USER", "STORE_OWNER"]),
});

export const privilegedInvitationSchema = z.object({
  email: normalizedEmail,
  role: z.enum(["ADMIN", "STORE_OWNER"]),
});

export const privilegedInvitationRegistrationSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/, "Enter the eight-character invitation code."),
  name: nameSchema,
  address: addressSchema,
  password: passwordSchema,
  // Present only for the one-time, environment-backed first-administrator
  // bootstrap. Database invitations always bind the email server-side.
  email: normalizedEmail.optional(),
});

export const storeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(20, "Store name must be at least 20 characters.")
    .max(60, "Store name must be at most 60 characters."),
  email: normalizedEmail,
  address: addressSchema,
  ownerId: z.string().uuid().nullable().optional(),
});
