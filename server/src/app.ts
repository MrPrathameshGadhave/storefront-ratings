import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { cacheControl, secureCacheHeaders } from "./middleware/cache-control.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { docsRouter } from "./routes/docs.js";
import { healthRouter } from "./routes/health.js";
import { ownerRouter } from "./routes/owner.js";
import { storesRouter } from "./routes/stores.js";

export const createApp = (): express.Express => {
  const app = express();
  app.disable("x-powered-by");
  if (env.trustProxy) app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(secureCacheHeaders);
  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(cacheControl);
  if (env.nodeEnv !== "test") {
    // Invitation URLs are bearer secrets. Morgan's default `:url` token would
    // otherwise write them to platform logs, so omit those requests entirely.
    app.use(morgan("tiny", { skip: (req) => req.path.startsWith("/api/auth/invitations/") }));
  }

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/stores", storesRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/owner", ownerRouter);
  app.use("/api/docs", docsRouter);

  app.use("/api", notFound);

  if (env.nodeEnv === "production") {
    const clientDist = path.resolve(process.cwd(), "client", "dist");
    app.use(express.static(clientDist));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
