import { createApp } from "./app.js";
import { assertRuntimeEnvironment, env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

assertRuntimeEnvironment();
const app = createApp();
const server = app.listen(env.port, () => {
  console.info(`Storefront Ratings API listening on port ${env.port}`);
});

const shutdown = (signal: string) => {
  console.info(`${signal} received; shutting down.`);
  server.close(() => {
    prisma
      .$disconnect()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
