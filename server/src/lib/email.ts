import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });

const getTransport = () => {
  if (!env.smtpHost || !env.smtpFrom) {
    throw new AppError(
      503,
      "EMAIL_UNAVAILABLE",
      "Email verification is temporarily unavailable. Please try again later.",
    );
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth:
      env.smtpUser && env.smtpPassword ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
  });
};

const emailDeliveryFailed = (): AppError =>
  new AppError(
    503,
    "EMAIL_DELIVERY_FAILED",
    "We could not send your verification email. Please try again later.",
  );

const recipientDeliveryFailure = (delivery: {
  accepted?: unknown;
  rejected?: unknown;
}): "recipient_rejected" | "no_accepted_recipients" | undefined => {
  const accepted = Array.isArray(delivery.accepted) ? delivery.accepted : [];
  const rejected = Array.isArray(delivery.rejected) ? delivery.rejected : [];

  if (rejected.length > 0) return "recipient_rejected";
  if (accepted.length === 0) return "no_accepted_recipients";
  return undefined;
};

export const sendVerificationEmail = async (email: string, otp: string): Promise<void> => {
  const transport = getTransport();
  const safeOtp = escapeHtml(otp);
  try {
    const delivery = await transport.sendMail({
      from: env.smtpFrom,
      to: email,
      subject: "Your Storefront Ratings verification code",
      text: [
        "Storefront Ratings email verification",
        "",
        `Your verification code is: ${otp}`,
        "This code expires in 10 minutes.",
        "If you did not request this, you can safely ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;color:#3B3C3E;line-height:1.55;max-width:560px;margin:auto">
          <h1 style="color:#A01C33;font-size:22px">Storefront Ratings</h1>
          <p>Use this verification code to finish creating your account:</p>
          <p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#A01C33">${safeOtp}</p>
          <p>This code expires in <strong>10 minutes</strong>.</p>
          <p>If you did not request this, you can safely ignore this email.</p>
        </div>`,
    });

    const failure = recipientDeliveryFailure(delivery);
    if (failure) {
      // Do not log the SMTP response: it can include the recipient address or provider details.
      console.error("Verification email delivery failed.", { reason: failure });
      throw emailDeliveryFailed();
    }
  } catch (error) {
    if (error instanceof AppError) throw error;

    // SMTP errors can include provider responses, recipient addresses, or message metadata.
    console.error("Verification email delivery failed.", { reason: "smtp_error" });
    throw emailDeliveryFailed();
  }
};
