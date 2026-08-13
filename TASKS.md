# Delivery checklist

## Completed in this workspace

- [x] Extracted every requirement from the supplied two-page assignment PDF.
- [x] Built the required React frontend, Express backend, PostgreSQL Prisma schema, and committed initial migration.
- [x] Added secure cookie sessions, server-side role authorization, registration OTP verification, password changes, admin management, store ratings, and owner reporting.
- [x] Enforced validation in the UI, API, and database where applicable.
- [x] Added safe demo seed data, Docker development services, environment template, health endpoint, and deployment-ready production build.
- [x] Added responsive desktop/mobile UI, loading, empty, error, forbidden, and not-found states.
- [x] Ran lint, TypeScript checks, Prisma schema validation, automated tests, and a production build.
- [x] Started isolated local PostgreSQL, applied the committed migration, and seeded non-destructive demo data.
- [x] Ran the real API workflow: registration, email OTP verification, login, store search, rating create/update, Store Owner aggregation, Admin totals/list, RBAC blocking, and logout.
- [x] Completed browser registration and OTP verification using MailHog; verified the configured external SMTP provider can authenticate.
- [x] Added an invitation-only privileged onboarding design: role-specific confidential routes, an Administrator invitation screen, server-derived roles, and a time-bounded first-Administrator bootstrap.

## Remaining external verification

- [ ] Confirm delivery of a fresh OTP in the selected external SMTP provider inbox. MailHog delivery and provider authentication have already passed.
- [ ] Complete a visual browser smoke test for all three role dashboards and their forms on the final build.
- [ ] Deploy the privileged-onboarding release, apply its committed Prisma migration, and smoke test the normal-user, Administrator, and Store Owner flows.
- [ ] For an empty production database only: configure all three first-Administrator bootstrap values, create the first Administrator, then delete the values and redeploy.
- [x] Published the source repository and configured the Vercel production project.

## High-Impact Enhancements

| Item                                        | Classification          | Estimate | Decision                                                                                                            |
| ------------------------------------------- | ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| Secure email OTP registration               | Essential               | M        | Implemented with hash-at-rest, expiry, cooldown, rate limits, and single-use verification.                          |
| Controlled Store Owner provisioning         | Essential               | S        | Implemented in the admin user workflow; an owner can be assigned when creating a store.                             |
| Confidential privileged-role invitations    | High value extension    | M        | Implemented as Administrator-issued, email-bound one-time links plus a separate code; pending release verification. |
| Safe evaluator seed data                    | High value              | S        | Implemented, non-destructively.                                                                                     |
| Responsive empty/error/forbidden states     | High value              | S        | Implemented.                                                                                                        |
| Live email-provider delivery                | Deployment prerequisite | S        | SMTP authentication is verified; confirm a received external inbox message before release.                          |
| Password reset, social login, real time, AI | Rejected                | M-L      | Outside the assignment scope.                                                                                       |

## Suggested commit sequence

1. `chore: initialize store ratings platform`
2. `feat: implement secure role-based rating workflows`
3. `feat: add responsive evaluator-ready frontend`
4. `test: cover validation otp and authorization flows`
5. `docs: add setup traceability and deployment guide`
6. `feat: add confidential administrator and store-owner invitations`
