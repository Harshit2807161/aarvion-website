# Environments and mock providers

Mock SMS, email, payments and files (and the `/dev/outbox` page) exist so previews
work before DLT and gateway onboarding. A mock OTP is written to the `dev_outbox`
collection of whatever database `MONGODB_URI` and `MONGODB_DB` point at, so a
mock-enabled deploy on the production database would expose real customers.

## Rules

- `ALLOW_MOCKS_IN_PROD_BUILD=1` is set only for the e2e build (`playwright.config.ts`)
  and in the Vercel **Preview** scope. It is never set in Production, and never in
  Vercel's "All Environments" scope.
- Previews use a separate preview database (a different `MONGODB_DB`, or a separate
  Atlas project), never the production one. `MONGODB_URI` and `MONGODB_DB` are set
  per scope.
- Vercel Deployment Protection stays on for previews.
- `/api/health` treats a production build with the flag as non-production, so the
  e2e smoke can run without a database. Vercel production (`VERCEL_ENV=production`)
  always fails closed.

## Enforcement status

Enforced. `isMockForbidden()` refuses mocks, and dev-only routes 404, when any of these hold:

- `VERCEL_ENV=production`;
- a production build without `ALLOW_MOCKS_IN_PROD_BUILD=1`;
- `MONGODB_DB`, or the database in the `MONGODB_URI` path, equals `aarvion_prod` (case-insensitive).

Production therefore sets `MONGODB_DB=aarvion_prod`. Every dev-only route calls
`requireDevRoute()` (`src/server/dev-only.ts`), which calls `notFound()` when the guard refuses.

- `__Host-aarv_sid` requires `Secure`: on plain http it works on `http://localhost` in Chrome and Firefox, but not in Safari or on LAN or `*.test` hosts, so use `localhost` or https for local dev.
