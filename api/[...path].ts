import { createApp } from "../server/src/app.js";
import { assertRuntimeEnvironment } from "../server/src/config/env.js";

// Vercel invokes this catch-all serverless function for every /api/* request.
// The React application itself is served from the static Vite output.
assertRuntimeEnvironment();

export default createApp();
