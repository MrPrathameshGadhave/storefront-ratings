# Registration and OTP troubleshooting

Use this guide when a new account cannot be registered or verified. It describes the current secure flow; do not bypass verification or write OTP codes to application logs.

## What must be available

Registration needs all three services:

1. The React client on http://localhost:5173.
2. The API on http://localhost:4000.
3. PostgreSQL and an SMTP server that the API can reach.

For local development, the included compose file provides PostgreSQL and MailHog:

```bash
docker compose up -d
```

MailHog accepts SMTP at localhost:1025 and shows delivered messages at http://localhost:8025. Compose does not start the API or client; start them separately with npm run dev.

## Required local configuration

Create .env from .env.example and keep these values aligned with the running local services:

```env
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/storefront_ratings?schema=public"
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="Storefront Ratings <no-reply@storefront-ratings.local>"
```

Then generate the client, apply the development migration, and run the application:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Check API/database connectivity at http://localhost:4000/api/health. A successful response includes data.status set to ok and data.database set to connected. If it returns 503, fix PostgreSQL or DATABASE_URL before retrying registration.

## Valid registration input

The registration form rejects invalid input before an OTP is created:

| Field    | Rule                                                                                 |
| -------- | ------------------------------------------------------------------------------------ |
| Name     | 20 to 60 characters after trimming.                                                  |
| Email    | A valid email address; normalized to lower case.                                     |
| Address  | Required and at most 400 characters.                                                 |
| Password | 8 to 16 characters, with an uppercase letter and a non-whitespace special character. |

Public registration always creates a normal-user account. Roles cannot be selected through this endpoint.

## Expected flow

1. Submit valid details.
2. The API returns HTTP 202 and opens the verification step.
3. Open MailHog at http://localhost:8025 and retrieve the email addressed to the submitted account.
4. Enter the six-digit OTP in the app.
5. The API returns HTTP 201 and creates a verified normal-user account.

The API never returns the OTP. Use the MailHog inbox in local development or the recipient's mailbox in a real SMTP environment.

## Common responses and the correct action

| Response                  | Meaning                                                                              | Safe next step                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 400 VALIDATION_ERROR      | One or more submitted fields do not meet the rules.                                  | Correct the field message shown in the form and submit again.                                        |
| 409 EMAIL_UNAVAILABLE     | A verified account already uses that email.                                          | Sign in or use another email address.                                                                |
| 429 RESEND_COOLDOWN       | A code was requested within the 60-second cooldown.                                  | Wait until the countdown finishes, then use Resend code.                                             |
| 429 RATE_LIMITED          | Too many requests came from the same IP in the rate-limit window.                    | Pause requests and retry later; do not refresh/re-submit repeatedly.                                 |
| 503 EMAIL_UNAVAILABLE     | SMTP is not configured for the running API.                                          | Set SMTP_HOST and SMTP_FROM, then restart the API.                                                   |
| 503 EMAIL_DELIVERY_FAILED | SMTP was configured but the email service rejected or could not deliver the message. | Check MailHog/provider availability and SMTP settings, then retry.                                   |
| 500 INTERNAL_ERROR        | An unexpected server-side issue occurred.                                            | Capture the safe request error and server log metadata, then investigate without adding OTP logging. |

## OTP rules that affect testing

- An OTP expires after ten minutes.
- A resend replaces the previous OTP.
- Five incorrect entries lock the current OTP; request a new one after the cooldown.
- A repeat registration attempt for the same pending email is also subject to the 60-second cooldown.

If an email was not received, first confirm that the correct MailHog inbox or production mailbox is being checked. Do not add a development backdoor, return the code from the API, disable verification, or log the plaintext OTP.

## Local diagnostic checklist

```bash
docker compose ps
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

- Confirm postgres and mailhog are running in docker compose ps.
- Visit http://localhost:4000/api/health.
- Confirm MailHog opens at http://localhost:8025.
- Confirm the API process started with the local SMTP_* variables, not legacy MAIL_* variables.
- Register with a fresh email address and valid name/password values.
- Inspect the MailHog inbox and complete verification.

For deployment-specific configuration, see [DEPLOYMENT.md](DEPLOYMENT.md). This workspace has verified local PostgreSQL, MailHog delivery, and browser registration/OTP verification; the selected external SMTP provider has passed an authentication check. Confirm delivery to its real inbox after requesting a fresh code before release.
