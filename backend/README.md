# The Haat of Art backend

Express + TypeScript API backed by MySQL `art`.

## Local setup

1. Copy `.env.example` to `.env` and keep `MYSQL_USER=root` / `MYSQL_PASSWORD=root` only for local development.
2. Ensure MySQL is running and the database named by `MYSQL_DATABASE` exists (local default: `art`), then run `pnpm --dir backend migrate`.
3. Start the API with `pnpm --dir backend dev` (port 4000).
4. Provision the first administrator with `pnpm --dir backend provision-admin admin@example.com 'a-strong-password-at-least-16-chars'`.
5. For the Next.js app, configure `BACKEND_API_URL` and `NEXT_PUBLIC_BACKEND_API_URL` as `http://localhost:4000` in the frontend environment.

The frontend remains at port 3000. In production, use a managed MySQL instance, a secret manager, TLS, an SMTP provider, and a worker for email delivery. Never commit `.env`, passwords, JWT secrets, OTPs, session tokens, or QR token values.

## API surface

- `GET /health`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `POST /api/auth/verify-email`, `POST /api/auth/resend-verification` — verify new visitor/exhibitor accounts with cryptographically random 6-digit codes.
- `POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/confirm` — request and verify one-time email codes to reset a password.
- `POST /api/auth/register-visitor` — creates an unverified Visitor account and sends an email code.
- `GET /api/passes/visitor/events`, `GET /api/passes/visitor/passes`, `POST /api/passes/visitor/events/:eventId/register` — visitor-only event discovery, pass list, and registration.
- `GET/PUT /api/passes/visitor/preferences` — visitor email announcement and transactional-notice preferences.
- `GET /api/passes/attendees` — registration-staff attendee lookup by exhibition, name, or email.
- `POST /api/passes/check-in` — permission-gated staff check-in; QR pass tokens are signed, stored as hashes, revocable, and single-use.
- `GET /api/events`, `POST /api/events`, `PATCH /api/events/:id/approve`, `PATCH /api/events/:id/publish`
- `POST /api/events/:id/media` — authenticated event media upload (50 MB maximum per file); image/video bytes are stored in MySQL.
- `GET /api/events/:id/media/:mediaId` — retrieve media for an approved or published event.
- `GET /api/homepage/media` — public homepage media URLs and metadata.
- `GET /api/homepage/media/:key` — retrieve an uploaded homepage image/video.
- `GET /api/content` — public homepage text overrides, artists and featured artworks.
- `POST /api/newsletter/subscribe` — stores an email subscription and sends a confirmation email; the footer form shows the thank-you response.
- `POST /api/newsletter/unsubscribe` — confirms an unsubscribe link. Active subscribers receive an email whenever a new blog post is published.
- `PUT /api/content/text`, `POST /api/content/artists`, `PUT /api/content/artists/:id/photo`, `DELETE /api/content/artists/:id`, `POST /api/content/artworks`, `DELETE /api/content/artworks/:id` — authenticated (SUPER_ADMIN, ADMIN, CONTENT_MANAGER) content management; images are stored in MySQL.
- `PUT /api/homepage/media/:key` — authenticated replacement upload for the header video, video poster, logo, category images or the contact page banner slot `contactHero` (50 MB maximum; MySQL `max_allowed_packet` must be larger than 50 MB).
- `GET /api/about` — public published About page snapshot (hero, foundation, company sections, team members, event partners). Returns `{ published: null }` until the first publish.
- `GET /api/about/draft`, `GET /api/about/history` — authenticated draft state (with `dirty` flag) and publish history (SUPER_ADMIN, ADMIN, CONTENT_MANAGER).
- `PUT /api/about/sections/:key` — authenticated draft edit for `hero`, `foundation`, `company` (rich-text bodies are HTML-sanitised server-side).
- `POST /api/about/media` — authenticated image upload to `media_assets` (50 MB maximum; MIME + file-signature validated).
- `POST/PUT/DELETE /api/about/team[/:id]`, `PUT /api/about/team/:id/photo`, `POST/PUT/DELETE /api/about/partners[/:id]`, `PUT /api/about/partners/:id/logo` — authenticated team member and event partner management, including ordering and active visibility.
- `POST /api/about/publish`, `POST /api/about/restore/:historyId` — publish the current draft snapshot (or restore an earlier one) as the live About page; SUPER_ADMIN and ADMIN only. All About admin actions are written to `audit_logs`.
- `POST /api/enquiries` — public contact enquiry (name, email, optional phone, category, subject, message, consent). Returns a human-readable `ENQ-YYYYMM-XXXX` reference, treats an identical email + subject pair within ten minutes as a duplicate, is rate limited, and queues the visitor acknowledgement plus admin notifications without ever blocking the saved enquiry.
- `POST /api/enquiries/:id/attachment` — public upload of up to three attachments (PDF/JPG/PNG/WebP/GIF, 5 MB, content-signature checked) while the enquiry is still `NEW` and younger than thirty minutes.
- `GET /api/enquiries` — authenticated (SUPER_ADMIN, ADMIN) list with search, status/category/priority/assignee filters, date range, sorting, pagination and counters (new, unassigned, in progress, resolved, spam, overdue). `GET /api/enquiries/:id` returns the private detail: message, incoming/outgoing/system thread, internal notes and attachment metadata.
- `PATCH /api/enquiries/:id` — status (`NEW → ASSIGNED → IN_PROGRESS → WAITING_FOR_REPLY → RESOLVED → CLOSED`, plus a separate `SPAM`), priority, assignee (validated as active staff, never a content manager), follow-up date and resolution note. `POST /api/enquiries/:id/notes` adds internal-only notes. `POST /api/enquiries/:id/reply` emails the visitor through the configured provider and logs delivery status; replying never auto-resolves an enquiry.
- `GET /api/enquiries/staff` — assignable staff. `GET /api/enquiries/export.csv` — CSV export, SUPER_ADMIN/ADMIN only, audited. `GET /api/enquiries/:id/attachments/:attachmentId` — admin attachment download. Every enquiry mutation is written to `audit_logs`.
- `GET /api/dashboard/summary`
- `GET /api/dashboard/users`, `PUT /api/dashboard/users/:userId/roles` — Super Admin role and per-user permission assignment with audit logging.
- `GET /api/dashboard/reports` — Admin/Super Admin operations, finance, and exhibition analytics.
- `GET /api/dashboard/audit` — permission-gated, paginated and searchable administrative audit trail.
- `GET /api/dashboard/system` — Super Admin runtime, database, account-security and email-queue health overview.

The migrations include the visitor, registration, QR pass, check-in, per-user permissions, newsletter, artist application, enquiry, audit, and email delivery tables. Visitor/exhibitor email verification, password resets, newsletter subscriptions, pass issuance, QR display, staff check-in, and per-user permission grants are implemented. The visitor UI scans with the browser's native QR detector when available and offers manual pass-code entry as a fallback. Contact enquiries, their workflow, attachments, notifications and audit trail are implemented end to end. The background email retry worker still needs implementation before production use.

OTP codes are generated with Node.js cryptographic randomness, stored as hashes, expire after five minutes, and allow at most five verification attempts. Signup verification and password-reset endpoints use this flow. Sign-in remains password-only to preserve existing sign-in behavior. Configure `FRONTEND_ORIGIN` and SMTP settings in the backend environment for production newsletter links and delivery.

## Local test environment

Use a separate disposable MySQL database for tests. Create both databases with a local MySQL account (never point tests at production):

```sql
CREATE DATABASE art CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE art_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy `.env.example` to `.env`, set `MYSQL_DATABASE=art`, and set `TEST_MYSQL_DATABASE=art_test`. Run `pnpm --dir backend migrate` for the development database; integration tests should override `MYSQL_DATABASE` with `art_test` in a dedicated test shell. `MAIL_MODE=log` keeps development email delivery local; OTPs and tokens are never logged by the application.

## Verification

- `pnpm --dir backend build` — backend TypeScript build
- `pnpm --dir backend test` — deterministic security and configuration tests
- `pnpm build` — frontend build
- Run `pnpm dev` and `pnpm --dir backend dev` in separate terminals to start both apps.

The health endpoint is `GET /health`; it returns `503` when the database is unavailable and never exposes credentials. MySQL integration, SMTP provider, QR concurrency, and production security tests remain skipped unless disposable services and credentials are explicitly configured.
