# The Haat of Art

The Haat of Art is an exhibition and art-community platform for discovering artists, browsing galleries and stories, booking exhibition stalls, and managing events. It includes a public-facing Next.js website and a role-based operations dashboard backed by an Express API and MySQL.

## Features

- Public pages for exhibitions, artists, artworks, blogs, contact, and event registration.
- Role-based dashboards for Super Admins, Admins, Content Managers, Registration Managers, artists, and visitors.
- Exhibition creation, media uploads, approval and publishing workflows.
- Artist applications, stall bookings, visitor registrations, QR passes, and staff check-in.
- Website content, homepage media, About page, artist, partner, and guest management.
- Blog moderation, contact enquiries, reports, and audit logs.
- Email verification, password reset, newsletter subscriptions, and transactional notifications.

## Technology

- **Frontend:** Next.js, React, TypeScript
- **Backend:** Express, TypeScript
- **Database:** MySQL
- **Package manager:** pnpm

## Requirements

- Node.js 20.9 or newer
- pnpm (Corepack is recommended)
- MySQL 8+

## Local setup

1. Install dependencies from the repository root and for the backend:

   ```powershell
   corepack enable
   pnpm install
   pnpm --dir backend install
   ```

2. Create a local MySQL database using `utf8mb4`, then copy the backend environment template:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```

   Update `backend/.env` with your local MySQL connection, a `JWT_SECRET` and `COOKIE_SECRET` of at least 32 characters, and the frontend origin. Keep `.env` files private and out of version control.

3. Apply database migrations:

   ```powershell
   pnpm --dir backend migrate
   ```

4. Start the API and frontend in separate terminals:

   ```powershell
   pnpm --dir backend dev
   ```

   ```powershell
   pnpm dev
   ```

   The frontend runs at `http://localhost:3000` and the API at `http://localhost:4000` by default. Set `NEXT_PUBLIC_BACKEND_API_URL` in the frontend environment if the API uses a different URL.

5. Provision the initial Super Admin account when needed:

   ```powershell
   pnpm --dir backend provision-admin admin@example.com "<strong-password-of-16-characters-or-more>" "Platform Administrator"
   ```

   Run this only against your intended database. Do not place real passwords in source files, documentation, or shell history.

## Useful commands

```powershell
pnpm build
pnpm backend:build
pnpm backend:test
```

Backend tests that use MySQL must use a separate disposable test database configured with `TEST_MYSQL_DATABASE`; never point tests at production data.

## Configuration and email

See [`backend/.env.example`](./backend/.env.example) for the backend configuration template. SMTP is needed for real email delivery; `MAIL_MODE=log` is suitable only for local development. Use a managed database, TLS, protected secrets, and a configured email provider for deployment.

## Security notes

- Never commit `.env` files, passwords, API tokens, session cookies, OTPs, or visitor QR-pass tokens.
- User passwords are stored as salted password hashes; authentication and management operations are permission-gated.
- Event and content media uploads are size-limited and checked against supported media signatures.
- Review the backend documentation in [`backend/README.md`](./backend/README.md) for API details and implementation notes.
