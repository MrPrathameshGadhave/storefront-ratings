import "dotenv/config";

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  trustProxy: process.env.TRUST_PROXY === "true",
  jwtSecret: required("JWT_SECRET", "development-only-change-me-before-production"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER,
  // SMTP_PASS is accepted for compatibility with common Gmail setup guides.
  // SMTP_PASSWORD remains the documented, preferred variable name.
  smtpPassword: process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM,
};

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

export const assertRuntimeEnvironment = (): void => {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  if (env.nodeEnv === "production") {
    if (
      env.jwtSecret === "development-only-change-me-before-production" ||
      env.jwtSecret === "replace-with-a-long-random-secret-at-least-32-characters" ||
      env.jwtSecret.length < 32
    ) {
      throw new Error(
        "JWT_SECRET must be a strong, unique value of at least 32 characters in production.",
      );
    }
    if (!env.smtpHost || !env.smtpFrom || !env.smtpUser || !env.smtpPassword) {
      throw new Error(
        "SMTP_HOST, SMTP_FROM, SMTP_USER, and SMTP_PASSWORD (or SMTP_PASS) must be set in production.",
      );
    }
  }
};
