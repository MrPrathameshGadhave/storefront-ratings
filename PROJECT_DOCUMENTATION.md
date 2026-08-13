# Storefront Ratings — Project documentation

## Overview

Storefront Ratings is a role-based web application built for the FullStack Intern Coding Challenge - V1.1. Normal users can discover stores and maintain a rating from 1 to 5. Administrators manage users and stores. Store Owners see rating activity and the average rating for their assigned store.

The selected permitted stack is React, Express, and PostgreSQL.

The production application is live at [storefront-ratings.vercel.app](https://storefront-ratings.vercel.app), using Vercel for the SPA and Express function and Neon for PostgreSQL. Its health endpoint has been verified with the database connected.

## Requirement coverage

The implementation includes the assignment's three roles, registration/login, ratings, search, sortable lists, administrator reporting, Store Owner reporting, required validation, and database constraints. It also includes responsive UI, secure OTP email verification, confidential privileged-role invitations, error/loading states, deployment configuration, automated tests, and traceability. See [REQUIREMENTS.md](REQUIREMENTS.md) for the evidence ledger.

## Implemented capabilities

- Normal-user registration, email verification, login, logout, and password change.
- Six-digit OTP verification with ten-minute expiry, HMAC-hashed storage, five-attempt limit, 60-second resend cooldown, code replacement, and endpoint rate limits.
- Administrator-issued, email-bound invitations for Administrator and Store Owner accounts, with a confidential URL, separate eight-character code, 72-hour lifetime, one-time redemption, and server-derived role.
- Store directory with name/address search, sorting, calculated average, personal rating, and an updateable 1–5 rating dialog.
- Administrator totals; searchable, filterable, sortable user and store lists; user details; account and store creation.
- Store Owner dashboard for the assigned store's average and rater list.
- Responsive burgundy design with keyboard-accessible forms, focus states, loading, empty and error states, 403/404 pages, and an error boundary.
- Health endpoint, OpenAPI/Swagger UI, local Docker dependency services, demo seed data, and build/test scripts.

## Technology stack

| Layer          | Technology                                           |
| -------------- | ---------------------------------------------------- |
| Frontend       | React 19, TypeScript, Vite, React Router, CSS        |
| Backend        | Express 5, TypeScript, Zod                           |
| Persistence    | PostgreSQL, Prisma ORM and migrations                |
| Authentication | HTTP-only JWT session cookie, bcrypt password hashes |
| Email          | Nodemailer; MailHog locally or SMTP in production    |
| Quality        | Vitest, ESLint, Prettier, TypeScript                 |

## Architecture

```text
React/Vite client
       | same-origin API requests, or Vite proxy in development
Express REST API
       | validation, sessions, RBAC, safe errors
Prisma ORM
       |
PostgreSQL
       |
Nodemailer -> MailHog locally / SMTP provider in production
```

The server is the authorization boundary. Client route guards improve usability, but every private API independently verifies the session and role.

## Folder structure

```text
client/
  src/components/       shared UI and application shell
  src/context/          auth and toast state
  src/lib/              API client and client validation
  src/pages/            auth, admin, owner, stores, status pages
server/
  src/config/           runtime environment validation
  src/lib/              Prisma, crypto, token, email, logging, errors
  src/middleware/       validation, auth/RBAC, rate limiting, errors
  src/routes/           auth, stores, admin, owner, health, API docs
  src/schemas/          Zod request schemas and tests
prisma/
  schema.prisma         data model
  migrations/           PostgreSQL migrations
  seed.ts               idempotent local/demo seed
```

## Data model

### User

Each user has an ID, name, normalized unique email, address, password hash, role, verification flag, and timestamps. Roles are ADMIN, NORMAL_USER, and STORE_OWNER. Indexed fields support role/name/email listing.

### Store

Each store has an ID, name, unique email, address, optional unique owner ID, and timestamps. A Store Owner is associated with zero or one store.

### Rating

Each rating has an ID, integer value, user ID, store ID, and timestamps. PostgreSQL enforces values from 1 through 5, and a composite unique constraint on user ID plus store ID makes a second rating an update instead of a duplicate.

### PendingRegistration

This temporary record stores a prospective normal user's fields, password hash, OTP HMAC hash, expiry time, attempt counter, and resend time. It is removed after successful verification or when an expired code is used.

### PrivilegedInvitation

This temporary record represents an Administrator-created invitation for either `ADMIN` or `STORE_OWNER`. It stores the invited email, role, creator, expiry, use timestamp, and code-attempt counter. The confidential URL token and eight-character registration code are never stored in plaintext: only separate HMAC hashes are persisted. A one-time conditional update consumes the record before the account is created.

## API reference

Success responses use the data envelope. Failures use the error envelope with a code, message, and optional fields object.

| Method   | Route                                 | Access                   | Purpose                                                                |
| -------- | ------------------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| GET      | /api/health                           | Public                   | Database health check                                                  |
| GET      | /api/docs                             | Public                   | Swagger UI                                                             |
| GET      | /api/docs/openapi.json                | Public                   | OpenAPI document                                                       |
| POST     | /api/auth/register                    | Public                   | Start normal-user registration and send OTP                            |
| GET      | /api/auth/invitations/:token          | Confidential link        | Validate a privileged invitation and return safe, role-locked metadata |
| POST     | /api/auth/invitations/:token/register | Confidential link + code | Redeem an invitation and create its server-derived account             |
| POST     | /api/auth/verify-email                | Public                   | Verify OTP and create account                                          |
| POST     | /api/auth/resend-verification         | Public                   | Send replacement OTP after cooldown                                    |
| POST     | /api/auth/login                       | Public                   | Start secure session                                                   |
| POST     | /api/auth/logout                      | Session                  | End session                                                            |
| GET      | /api/auth/me                          | Session                  | Current authenticated user                                             |
| PATCH    | /api/auth/password                    | Session                  | Change password with current password                                  |
| GET      | /api/stores                           | Normal User              | Store list with search and sort                                        |
| PUT      | /api/stores/:storeId/rating           | Normal User              | Create or update a rating                                              |
| GET      | /api/admin/dashboard                  | Admin                    | User/store/rating totals                                               |
| POST     | /api/admin/invitations                | Admin                    | Create a confidential `ADMIN` or `STORE_OWNER` invitation              |
| GET/POST | /api/admin/users                      | Admin                    | List/filter/sort or provision users                                    |
| GET      | /api/admin/users/:userId              | Admin                    | User details and owner-store rating detail                             |
| GET/POST | /api/admin/stores                     | Admin                    | List/search/sort or create stores                                      |
| GET      | /api/owner/dashboard                  | Store Owner              | Assigned store and its raters                                          |

Admin user query fields are name, email, address, role, sortBy, and sortDir. Store listing query fields are search, sortBy, and sortDir. Lists return all matching records, meeting the assignment's “view all” requirement without a hidden client cap.

## Authentication, authorization, and OTP

Login verifies bcrypt credentials and sets an HTTP-only session cookie. The backend loads the current user for each protected request, requires a verified email, and checks role authorization. A role claim in a token is not enough on its own to authorize access.

Public registration creates only a NORMAL_USER account. A public form cannot choose its role. Administrators remain the only actors who can create privileged accounts, either through the protected management workflow or through a privileged invitation. Store Owner data is derived from the authenticated user's server-side store association; no client-provided owner/store identifier decides access.

OTP flow:

1. The registration form validates and normalizes the details.
2. The server hashes the password, securely generates a numeric OTP, stores an HMAC hash, and sends HTML/text email.
3. The OTP expires after ten minutes. A new code replaces the old code.
4. Incorrect codes increase a counter; five incorrect attempts require a new code.
5. Resends have a 60-second cooldown. Authentication endpoints have an in-memory per-IP rate limiter suited to a single process.
6. Correct verification uses a serializable database transaction, creates the verified account, then deletes the pending record.

The plaintext OTP is never returned by an API, included in a URL, or logged. The client supports six numeric boxes, paste, mobile numeric input, backspace navigation, masked email, and a resend countdown.

### Privileged invitation flow

1. An authenticated Administrator enters an email and selects `ADMIN` or `STORE_OWNER` from the protected invitation screen.
2. The server creates a 256-bit URL-safe token and an eight-character code. It returns each secret once to that Administrator, stores only HMAC hashes, and invalidates any earlier unused invitation for the same email.
3. The Administrator shares the confidential role-specific URL and code through trusted channels. The invite is email-bound, expires after 72 hours, and accepts at most five incorrect code attempts.
4. The recipient completes the role-specific registration form. The backend takes the email and role from the invitation rather than the browser request, then uses a serializable transaction to consume the invitation and create a verified account.
5. The recipient signs in on the same login page as every other user. Server-side role checks and role-aware routing send them only to their authorized workspace.

For a deployment with no Administrator, the optional first-Administrator bootstrap uses `ADMIN_BOOTSTRAP_TOKEN`, `ADMIN_BOOTSTRAP_CODE`, and `ADMIN_BOOTSTRAP_EXPIRES_AT` as server-only values. It activates only when all three are present and the database has zero Administrator accounts. Set a future ISO-8601 expiry, use the matching `/register/admin/<token>` URL exactly once with the code, then remove all bootstrap variables and redeploy. This is an initialization aid, not a public sign-up path.

## Validation and safe errors

- Person and store names: 20 to 60 characters.
- Address: required, maximum 400 characters.
- Password: 8 to 16 characters, at least one uppercase letter and one non-whitespace special character.
- Email: trimmed, lower-cased, and validated.
- Rating: integer 1 through 5 at client, API, and PostgreSQL levels.

Zod validates API requests, and client forms repeat the rules for immediate field feedback. Centralized Express error handling returns safe validation, authorization, conflict, not-found, and unexpected-error responses.

## Design and accessibility

The interface uses a restrained maroon palette near #A01C33, warm neutral surfaces, charcoal typography, responsive grids/tables, semantic landmarks, visible focus styles, labelled fields, accessible dialogs, and keyboard-operable controls. It includes empty, retryable-error, loading, forbidden, not-found, and global-error states.

## Local setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ or Docker Desktop
- MailHog or another SMTP sink for local OTP inspection

### Steps

```bash
cp .env.example .env
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The Vite app runs at http://localhost:5173 and Express runs at http://localhost:4000. On PowerShell, use Copy-Item .env.example .env instead of cp.

For Docker-based local dependencies:

```bash
docker compose up -d
```

By default this starts PostgreSQL on port 5432 and MailHog SMTP on 1025, with the MailHog inbox at http://localhost:8025. If port 5432 is already used, set POSTGRES_PORT=5434 before docker compose up -d and change the port in DATABASE_URL to 5434 as well. The default environment file assumes port 5432.

## Environment variables

| Variable                                                                | Purpose                                                                                              |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| DATABASE_URL                                                            | PostgreSQL connection URL                                                                            |
| NODE_ENV and PORT                                                       | Runtime mode and API port; port defaults to 4000                                                     |
| CLIENT_ORIGIN                                                           | Allowed client origin                                                                                |
| TRUST_PROXY                                                             | Set true only behind a trusted reverse proxy                                                         |
| JWT_SECRET and JWT_EXPIRES_IN                                           | Session signing configuration                                                                        |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM               | Email delivery configuration; SMTP_PASS is also accepted for Gmail compatibility.                    |
| ADMIN_BOOTSTRAP_TOKEN, ADMIN_BOOTSTRAP_CODE, ADMIN_BOOTSTRAP_EXPIRES_AT | Three server-only values required together to enable the time-bounded first-Administrator bootstrap. |

Production startup rejects missing DATABASE_URL, weak/default JWT secrets, and missing SMTP host/from configuration.

## Demo data

The seed uses non-destructive upserts: existing demo rows are not overwritten.

| Role          | Email                  | Password   |
| ------------- | ---------------------- | ---------- |
| Administrator | admin@storefront.local | DemoPass!1 |
| Store Owner   | owner@storefront.local | DemoPass!1 |
| Normal User   | user@storefront.local  | DemoPass!1 |

These credentials are local/demo-only and must not be used for a public deployment.

## Testing and recorded checks

Run the full local command set before submission:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npx prisma validate
npm run build
```

The latest recorded results in this workspace are:

- ESLint: passed.
- TypeScript: passed for client and server.
- Vitest: 77 tests passed in the default suite; 2 real-database integration tests are skipped by default because they require an explicitly isolated test database. Those 2 tests also passed when explicitly run against the isolated database.
- Prisma schema validation: passed.
- Production API and Vite build: passed.
- Local PostgreSQL migration/seed, MailHog OTP delivery, and browser registration/OTP verification: passed.
- External SMTP authentication: passed; delivery to the selected provider inbox still needs one final confirmation.

The automated suite covers validation, OTP rules and hashing, authorization, safe query behavior, and rating request contracts. The dedicated integration suite additionally exercises registration, verification, login, rating update, and role boundaries against real isolated PostgreSQL. Local environment checks exercised MailHog and the browser registration journey. The public Vercel deployment has been checked for SPA routing, API routing, and a connected Neon database; provider-inbox delivery remains the final release check.

## Production deployment

1. Provision PostgreSQL and an SMTP provider.
2. Set all environment variables, including a random 32+ character JWT_SECRET, production CLIENT_ORIGIN, SMTP values, and TRUST_PROXY=true only when appropriate. For an empty production database, add all three first-Administrator bootstrap values only for the initial setup.
3. Run npm ci, npm run prisma:deploy, and npm run build. On a Node host, run npm prune --omit=dev only after migration and build.
4. Start with npm start. Use the confidential first-Administrator URL and code once if needed, then remove the bootstrap variables and restart/redeploy. Express serves the SPA from client/dist in production.
5. Verify /api/health, SMTP-backed OTP delivery, creation and redemption of privileged invitations, each role login, rating update, Store Owner aggregation, Admin totals, and direct-route refresh in a browser.

The Dockerfile builds the production application. Compose is for local PostgreSQL and MailHog dependencies, not a complete production composition. See [DEPLOYMENT.md](DEPLOYMENT.md) for the precise container and reverse-proxy guidance.

## Security considerations

- Passwords use bcrypt with cost 12.
- Session cookies are HTTP-only, SameSite=Lax, and Secure in production.
- Helmet headers, a JSON request-size limit, credentialed CORS policy, rate limiting, safe error responses, and no raw secrets in source are used.
- OTPs are cryptographic, hashed, expiring, retry-limited, and single-use.
- Privileged invitation tokens and codes are separate secrets, HMAC-hashed at rest, expiring, one-time, email-bound, and redeemed atomically. Their role and email never come from the browser.
- First-Administrator bootstrap values are server-only, valid only before the first Administrator exists and before their configured expiry, and must be removed after that account is created.
- Database uniqueness and check constraints protect rating integrity.
- The rate limiter is in-memory and per process; multi-instance production hosting should use a shared store such as Redis.

## Engineering decisions

- The assignment does not prescribe how Store Owners are created or linked. An Administrator can provision a Store Owner, and an owner can be assigned to zero or one store.
- The assignment requires public registration for normal users. The privileged invitation flow is an additional, invitation-only path; it never makes Administrator or Store Owner selection public.
- The PDF's 20–60 “Name” rule is applied consistently to person and store names.
- A rating update replaces the previous rating for a user/store pair rather than creating duplicates.
- Administrator-provisioned accounts are verified through the trusted administrative workflow; self-registration requires OTP verification.

## Known limitations and next checks

- Confirm delivery of a newly requested code in the selected external SMTP provider inbox.
- The in-memory rate limiter should be replaced with a shared distributed limiter for horizontally scaled deployments.
- Pagination may be added once it can preserve the assignment's “view all” requirement with an accessible UI.
- Potential future work includes audit trails, account recovery, admin edit/delete workflows, an enabled database-backed integration run, and deployment screenshots.
