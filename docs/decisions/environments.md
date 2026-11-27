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

- `APP_URL` is required in every Vercel scope that serves customers (Production, and Preview
  if its sitemap should name the preview host). The canonical
  links, Open Graph URLs and product JSON-LD are built from it; unset, they point at
  `http://localhost:3000`, except in Production (`VERCEL_ENV=production`), where a missing or invalid
  value makes `getSiteEnv()` throw an `EnvError` so the build fails instead of shipping localhost
  URLs.

## Build-time database (Cache Components)

Pages prerender from the catalogue at build time (`src/lib/catalogue/cached.ts`), so a build
reads Mongo. It fails closed: it never deploys an empty storefront.

- Every Vercel scope (Preview and Production) needs `MONGODB_URI` and `MONGODB_DB` available
  **at build time**, with the same values as at runtime.
- That database must be seeded: with the scope's `MONGODB_URI` and `MONGODB_DB` exported, run
  `pnpm db:indexes && pnpm seed` (insert-only, safe to re-run).
- Atlas network access must admit Vercel's build machines as well as its functions. Their IPs
  are not fixed, so this means access from anywhere with strong credentials, or a fixed-egress
  option such as Vercel Secure Compute.
- Failure modes, each a failed build (the live deploy stays up): no `MONGODB_URI` ("MONGODB_URI
  is not set"); an unreachable cluster (fails after the 3 s server-selection timeout); an empty
  catalogue (`CatalogueEmptyError` from `generateStaticParams`, naming `MONGODB_DB` and the seed
  command).
- CI: the `build` job seeds `aarvion_build`; the `e2e` job seeds `aarvion_e2e`.
- Freshness: catalogue writes call `revalidateCatalogue()` (`revalidateTag("catalogue",
  { expire: 0 })`), so the next request re-reads Mongo; `cacheLife("hours")` is a backstop.
  A new deploy starts with an empty cache. Three gaps:
  - **A direct database edit is not expired.** An MRP changed in mongosh or the Atlas UI calls
    nothing, and in Production `POST /dev/catalogue/revalidate` answers 404. The old price can
    show until the 1 h backstop (the first request after it may still get the old page while it
    refreshes) or until a redeploy. Until the phase D admin MRP editor exists (it calls
    `revalidateCatalogue()`), the procedure is: edit, then redeploy.
  - **The browser may keep a page for up to 5 minutes** (the `hours` profile's client `stale`
    time), even after a revalidation.
  - **Cart and checkout always reprice from Mongo**, never from the page, so a stale page never
    sets the charged price.

## Enforcement status

Enforced. `isMockForbidden()` refuses mocks, and dev-only routes 404, when any of these hold:

- `VERCEL_ENV=production`;
- a production build without `ALLOW_MOCKS_IN_PROD_BUILD=1`;
- `MONGODB_DB`, or the database in the `MONGODB_URI` path, equals `aarvion_prod` (case-insensitive).

File stores: `FILE_STORE=memory` and the dev disk store `FILE_STORE=local` count as mocks, and
both are also refused whenever `VERCEL_ENV` is set (Preview included), because they do not persist
across Vercel functions. Every Vercel scope uses `FILE_STORE=blob` with its own private store (Phase K+R plan,
Task R3).

Production therefore sets `MONGODB_DB=aarvion_prod`. Every dev-only route calls
`requireDevRoute()` (`src/server/dev-only.ts`), which calls `notFound()` when the guard refuses.

- `__Host-aarv_sid` requires `Secure`: on plain http it works on `http://localhost` in Chrome and Firefox, but not in Safari or on LAN or `*.test` hosts, so use `localhost` or https for local dev.
