# Deployment guide

## What is deployed

Storefront Ratings is a TypeScript application with:

- a React/Vite client;
- an Express API and production SPA server;
- PostgreSQL through Prisma;
- SMTP-based email verification.

In development, Vite runs on port 5173 and proxies API calls to Express on port 4000. In production, Express serves both the API and the built client from one process on port 4000 by default.

Docker Compose is deliberately limited to local dependencies: PostgreSQL and MailHog. It does not run the API or the web client.

## Prerequisites

- Node.js 20 or newer;
- npm;
- PostgreSQL and an SMTP service for deployment;
- Docker Desktop only if using the included local PostgreSQL and MailHog services.

## Local setup

Start the local database and email inbox:

```bash
docker compose up -d
```

The compose file starts:

| Service       | Address               |
| ------------- | --------------------- |
| PostgreSQL 16 | localhost:5432        |
| MailHog SMTP  | localhost:1025        |
| MailHog inbox | http://localhost:8025 |

PostgreSQL uses host port 5432 by default. If another local service already uses it, set POSTGRES_PORT=5434 before starting Compose and change the port in DATABASE_URL to 5434 as well.

Then configure and start the application:

```powershell
Copy-Item .env.example .env
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Use cp .env.example .env instead of the first command on macOS/Linux.

| Component          | URL                                         |
| ------------------ | ------------------------------------------- |
| Vite client        | http://localhost:5173                       |
| Express API        | http://localhost:4000/api                   |
| OpenAPI/Swagger UI | http://localhost:4000/api/docs              |
| OpenAPI JSON       | http://localhost:4000/api/docs/openapi.json |
| Health endpoint    | http://localhost:4000/api/health            |

## Runtime configuration

Copy .env.example rather than creating a new environment file from memory. The current variable names are:

| Variable                 | Purpose                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL             | PostgreSQL connection URL.                                                                                                              |
| NODE_ENV                 | Runtime mode. Use production for deployed builds.                                                                                       |
| PORT                     | Express port; defaults to 4000.                                                                                                         |
| CLIENT_ORIGIN            | Allowed client origin for credentialed CORS.                                                                                            |
| TRUST_PROXY              | Set to true only behind a trusted reverse proxy that supplies client IP information.                                                    |
| JWT_SECRET               | Unique session-signing secret. Production rejects example/default values and values shorter than 32 characters.                         |
| JWT_EXPIRES_IN           | Session lifetime; defaults to 8h.                                                                                                       |
| SMTP_HOST, SMTP_PORT     | SMTP server hostname and port.                                                                                                          |
| SMTP_USER, SMTP_PASSWORD | SMTP credentials when the provider needs them. SMTP_PASS is also accepted for Gmail compatibility; prefer SMTP_PASSWORD for new setups. |
| SMTP_FROM                | Sender displayed on verification emails.                                                                                                |

The local example targets the services in compose:

```env
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
TRUST_PROXY=false
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/storefront_ratings?schema=public"
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="Storefront Ratings <no-reply@storefront-ratings.local>"
```

Never commit a populated .env file, database password, JWT secret, or SMTP password.

## Production deployment on Vercel

The repository is ready to run as one Vercel application. The root `server.ts` exports the Express
app for Vercel's Node runtime, and `vercel.json` runs the production build. Vercel detects the
Express entry point while the compiled React application and `/api` routes remain served from the
same HTTPS origin.

Before deploying, provision a **managed PostgreSQL database**. A local Docker database is not
reachable from Vercel. Add these environment variables in the Vercel project's **Production**
environment (and Preview too if preview testing is desired):

| Variable                                                            | Production value                                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `NODE_ENV`                                                          | `production`                                                                     |
| `DATABASE_URL`                                                      | Managed PostgreSQL connection string, including `?schema=public`                 |
| `JWT_SECRET`                                                        | New random secret of at least 32 characters                                      |
| `JWT_EXPIRES_IN`                                                    | `8h`, or the chosen session lifetime                                             |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Real SMTP-provider configuration                                                 |
| `TRUST_PROXY`                                                       | `true`                                                                           |
| `CLIENT_ORIGIN`                                                     | The final Vercel production URL, such as `https://storefront-ratings.vercel.app` |

Then:

1. Link or import the repository as a Vercel project from the repository root.
2. Apply the committed schema to the managed database once with `npm run prisma:deploy`, using the
   same production `DATABASE_URL` in a secure shell or deployment job.
3. Deploy to production. Vercel runs `npm run build`, which generates Prisma Client and builds the
   API and client.
4. Visit `/api/health`, then test registration, a real SMTP inbox delivery, login, the three role
   dashboards, a rating update, and a direct-route refresh.

Use a real production SMTP provider and a fresh app password or API credential. Never add those
credentials to Git, `vercel.json`, documentation, or client-side environment variables.

## Production deployment on a Node host

1. Provision PostgreSQL and an SMTP provider.
2. Set production values for all required environment variables. Use a random JWT_SECRET with at least 32 characters, a real SMTP_HOST and SMTP_FROM, and the deployed client origin.
3. Run the database migration before starting the new version.
4. Build the server and client.
5. Remove development dependencies only after migration and build, then start the process.

An example deployment sequence is:

```bash
npm ci
npm run prisma:deploy
npm run build
npm prune --omit=dev
NODE_ENV=production npm start
```

The order matters: Prisma CLI is a development dependency, so migrations and builds must run before npm prune --omit=dev. The start command serves the compiled Express application from server/dist and the SPA from client/dist.

Before accepting a deployment, verify:

```bash
curl -i https://your-domain.example/api/health
```

Then run the registration/OTP flow, sign in with each role, create/update a rating, verify the Store Owner aggregation, verify Admin totals, and refresh a direct client route. A complete browser end-to-end smoke test still needs to be performed against the selected deployment.

## Docker image

The checked-in Dockerfile is a multi-stage production build:

1. The build stage runs npm ci.
2. It generates Prisma Client and builds the API and Vite client.
3. The runtime stage copies the built artifacts, Prisma files, package files, and the build stage's node_modules, exposes port 4000, and runs server/dist/index.js.

Build the image:

```bash
docker build -t storefront-ratings:latest .
```

Run it only with real environment values and a reachable PostgreSQL/SMTP service:

```bash
docker run --rm -p 4000:4000 \
  --env-file .env.production \
  storefront-ratings:latest
```

On Docker Desktop, a database running on the host may be reached using host.docker.internal in DATABASE_URL; a managed database should use its normal hostname. The current Dockerfile copies the build-stage node_modules into the runtime image and therefore does not yet prune development dependencies. That is acceptable for the assignment image but should be optimized before a cost-sensitive production rollout.

## Reverse proxy and TLS

Terminate TLS at a managed platform or reverse proxy, forward requests to port 4000, and set standard X-Forwarded-* headers. Set TRUST_PROXY=true only when that proxy is trusted and correctly configured. Do not set it merely because the service happens to be public.

The application sends Secure session cookies only when NODE_ENV=production. Serve the deployed application over HTTPS so those cookies work as intended.

## Database and seed behavior

- npm run prisma:migrate is for creating/applying development migrations.
- npm run prisma:deploy applies committed migrations without creating a new migration.
- npm run prisma:seed creates or updates local demo records using non-destructive upserts.

Do not run the demo seed against a shared production database unless those demo accounts are explicitly wanted.

## Verification status

The latest recorded default test run had 74 passing tests and 2 safe real-database integration tests skipped by default. Those two tests passed when run against an explicitly isolated database. Lint, type checking, Prisma validation, and the production build also passed after the release fixes.

This workspace has also completed local PostgreSQL migration/seed, MailHog OTP delivery, and browser registration/OTP verification. External SMTP authentication is verified; before a public release, confirm an actual external inbox delivery, deploy over HTTPS, and complete a deployed smoke test.

For registration-specific setup and safe troubleshooting, see [REGISTRATION_ERROR_FIX.md](REGISTRATION_ERROR_FIX.md).
