import { createApp } from "./server/src/app.js";
import { assertRuntimeEnvironment } from "./server/src/config/env.js";

// Vercel detects this root Express entry point and invokes the exported app
// as a serverless function. The local production server continues to use
// server/src/index.ts, which owns the explicit HTTP listener.
assertRuntimeEnvironment();

export default createApp();
