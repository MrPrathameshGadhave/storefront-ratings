import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));

vi.mock("../config/env.js", () => ({
  env: {
    smtpHost: "smtp.example.test",
    smtpPort: 587,
    smtpUser: "mailer-user",
    smtpPassword: "mailer-password",
    smtpFrom: "Storefront Ratings <mailer@example.test>",
  },
}));

const { sendVerificationEmail } = await import("./email.js");

const recipient = "recipient@example.test";

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail } as never);
    mocks.sendMail.mockResolvedValue({ accepted: [recipient], rejected: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when SMTP accepts the recipient", async () => {
    await expect(sendVerificationEmail(recipient, "123456")).resolves.toBeUndefined();

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: recipient,
        subject: "Your Storefront Ratings verification code",
      }),
    );
  });

  it("fails without logging recipient details when SMTP rejects a recipient", async () => {
    mocks.sendMail.mockResolvedValue({ accepted: [], rejected: [recipient] });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendVerificationEmail(recipient, "123456")).rejects.toMatchObject({
      statusCode: 503,
      code: "EMAIL_DELIVERY_FAILED",
    });

    expect(errorLog).toHaveBeenCalledWith("Verification email delivery failed.", {
      reason: "recipient_rejected",
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(recipient);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("123456");
  });

  it("fails when SMTP reports no accepted recipients", async () => {
    mocks.sendMail.mockResolvedValue({ accepted: [], rejected: [] });

    await expect(sendVerificationEmail(recipient, "123456")).rejects.toMatchObject({
      statusCode: 503,
      code: "EMAIL_DELIVERY_FAILED",
    });
  });
});
