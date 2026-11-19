# Architecture

## Principles

- **Rules live in `src/server/**`**, which is framework-free. The one exception is
  `src/server/dev-only.ts`, which imports `notFound` from `next/navigation` (ruling F15). Route
  handlers under `src/app/` stay thin: check the origin, parse with zod, call one service
  function, map the result.
- **Time is a parameter.** Domain and database functions take `now: Date`; a route reads
  `getDeps().now()` once per request. Expiry is decided in code from `now`, never left to the TTL
  monitor, so tests use a fake clock and never wait.
- **Writes that can race are one atomic single-document operation:** rate-limit counters, OTP
  attempts and single use, sessions, user find-or-create, the order counter. Nothing reads and
  then writes. A concurrent upsert that hits E11000 retries once.
- **External services sit behind interfaces** in a `deps` container, with mocks for dev and test
  that production refuses.
- **Env is lazy.** Importing any module never throws; the first call that needs a missing value
  throws `EnvError` naming the key.

## Folders

| Path | Holds |
| --- | --- |
| `src/app/api/health/route.ts` | `GET /api/health`: version plus a DB ping |
| `src/app/api/auth/otp/send/route.ts` | `POST /api/auth/otp/send` |
| `src/app/api/auth/otp/verify/route.ts` | `POST /api/auth/otp/verify` (sets the session cookie) |
| `src/app/api/auth/me/route.ts` | `GET /api/auth/me` (re-issues a sliding customer cookie) |
| `src/app/api/auth/logout/route.ts` | `POST /api/auth/logout` (204, clears the cookie) |
| `src/app/dev/outbox/route.ts` | `GET /dev/outbox?to=` (dev only) |
| `src/app/dev/styleguide/page.tsx` | `/dev/styleguide` (dev only): every button variant, the Rx badge, tags, stamp and inline prices and the icon grid, for visual review |
| `src/proxy.ts` | answers a real HTTP 404 for every `/dev/*` request wherever `isMockForbidden()` is true, before anything renders |
| `src/app/layout.tsx`, `page.tsx` | root layout (`lang="en-IN"`, viewport, theme colour) and the "coming soon" placeholder home |
| `src/app/globals.css` | Tailwind 4 entry: the design tokens in `@theme`, copied verbatim from the prototype (Prettier-ignored) |
| `src/styles/` | ported prototype CSS imported by `globals.css` (`base.css`: one merged `@layer base` with resets, focus, type and utilities; `buttons.css`: `.btn*`, `.link`, `.spin`; `stamp.css`: `.dm`, `.stamp*`, `.off`, `.price-inline`, `.rx`, `.tag*`; `forms.css`: `.field`, `.input`, `.check*`, `.seg*`, plus the ported switch, option-card and error-summary rules; the last three are imported `layer(components)`), with `tokens.test.ts` and `css-hygiene.test.ts` |
| `src/lib/` | `cn.ts` (`clsx` + `tailwind-merge` class helper), `format/rupees.ts` (Indian rupee formatting) |
| `components.json` | shadcn/ui config; only `dialog` and `input-otp` may be added (UI plan ruling) |
| `src/server/` | business logic (below) |
| `tests/int/`, `tests/helpers/` | integration tests and their helpers |
| `e2e/` | Playwright specs |
| `scripts/` | `pr-size.ts`, `merge-gate.sh`, `sync-product-images.ts`, `seed.ts`, `db-indexes.ts`, `subset-fonts.ts`, `shoot.mjs` (screenshots); Python asset tools (`render_foil.py`, `make_cutouts.py`, `composite_store_banners.py`, `build_stage0_docs.py`, …) |
| `data/` | `products.json` (seed source), `product-images.json` (generated), `source/` (Drive analysis) |
| `public/products/` | generated, content-hashed product images |
| `public/foil/`, `public/banners/` | foil, dome and banner rasters copied unchanged from `design/prototype/assets/`, each with a `.json` provenance sidecar (`scripts/public-provenance.test.ts`) |
| `src/components/` | React components, added task by task (today `base/`: the icon set, `BrandMark`, `Button`, `ButtonLink`, `RxBadge`, `StatusTag`, `Rupees`, `StampPrice` and `PriceInline`; `form/`: `TextField`, `Checkbox` and `Segmented`, which wire hint and error ids with `aria-describedby` and `aria-invalid`; `home/`: the banner carousel reducer and controller hook; `film/`: the scroll film's progress maths and engine) |
| `public/brand/` | the official logo variants and app icons served to the site, copied from the masters (usage guide in its README) |
| `src/fonts/` | committed `.woff2` subsets and `index.ts` (`next/font/local`), built by `pnpm fonts:subset` from `assets/fonts/` |
| `assets/` | source photos and cutouts; `brand/official/` (the traced logo masters, made by `scripts/trace_logo.py`); banner scenes; `fonts/` (source TTFs, OFL licences, `SOURCES.json`, README) |
| `design/prototype/` | the approved hi-fi prototype (excluded from ESLint) |

Planned folders (UI plan): more of `src/components/**` and `src/lib/**`, and `src/config/`. See
the plan's "File Structure".

## Server modules

| Module | Responsibility |
| --- | --- |
| `env.ts` | `getEnv()`, `requireEnv(key)`, `EnvError`, `resetEnvForTests()` |
| `deps.ts` | `getDeps()` → `{ sms, email, payments, files, now }`; `setDepsForTests`, `resetDepsForTests`; re-exports `readOutbox` |
| `providers/` | `types.ts` (interfaces), `mock-sms.ts`, `mock-email.ts`, `outbox.ts` (`dev_outbox`), `fake-payments.ts`, `memory-files.ts`, `guard.ts` (`isMockForbidden`, `PRODUCTION_DB_NAME`) |
| `dev-only.ts` | `requireDevRoute()`: `notFound()` whenever mocks are forbidden |
| `http.ts` | `HttpError`, `jsonResponse` (`no-store`), `readJson` (16 KB cap, exact `application/json`), `withErrors` |
| `db/client.ts` | one cached `MongoClient` per process on `globalThis` (survives HMR, drops a failed connect); `getDb()` uses `MONGODB_DB` |
| `db/indexes.ts` | `registerIndexes(collection, specs)` (names mandatory), `ensureIndexes(db)` (creates missing indexes by name) |
| `db/register-all.ts` | imports every module that registers indexes, for `pnpm db:indexes` and int tests |
| `catalogue/` | `schema.ts` (zod), `pricing.ts`, `categories.ts`, `collections.ts`, `seed.ts`, `search.ts`, `queries.ts`, `order.ts` (pure `compareVariants`, `orderForShelf`; client-safe) |
| `auth/` | `identifier.ts`, `otp.ts`, `users.ts`, `sessions.ts`, `cookie.ts`, `login.ts` (`sendOtp`, `verifyOtpAndLogin`), `guards.ts` (`getAuth`, `requireUser`, `requireRole`), `roles.ts` |
| `security/` | `rate-limit.ts` (`hitRateLimit`, `peekRateLimit`, `resetRateLimit`), `client-ip.ts` (`clientIp`, `ipBucket`), `origin.ts` (`assertSameOrigin`) |
| `audit.ts` | `appendAudit()`, the only writer of `audit_logs` |
| `orders/status.ts` | pure state machine: `ORDER_EDGES`, `transition()`, `initialStatus()` |
| `orders/order-number.ts` | `nextOrderNumber(now)`, `formatOrderNumber`, `orderMonthKey` |
| `prescriptions/validity.ts` | `isRxValidOn(rx, at)`, `addCalendarMonthsIst`, `RX_VALIDITY_MONTHS = 6` |

## Collections and indexes

| Collection | `_id` | Indexes (name) | Written by |
| --- | --- | --- | --- |
| `products` | ObjectId | `slug_unique`, `category_active_sortOrder`, `familySlug_active` | seed |
| `categories` | ObjectId | `slug_unique` | seed |
| `rate_limits` | the limiter key | `expiresAt_ttl` | `hitRateLimit` |
| `otp_challenges` | `<channel>:<value>` (one live challenge per identifier) | `expiresAt_ttl` | `issueOtpChallenge`, `verifyOtpChallenge` |
| `users` | ObjectId | `phone_unique`, `email_unique` (both partial) | `findOrCreateUserByIdentifier`, `setUserRole` |
| `sessions` | SHA-256 of the token | `expiresAt_ttl`, `userId_1` | `createSession`, `resolveSession`, `revokeSession` |
| `audit_logs` | ObjectId | `at_desc`, `actorUserId_at_desc` | `appendAudit` |
| `dev_outbox` | `mock_<uuid>` | `expiresAt_1` (TTL 24 h), `to_1_createdAt_1` | mock SMS and email |
| `counters` | `order-number:<YYMM>` | none | `nextOrderNumber` |

Rate-limit keys: `otp-send:ip:<bucket>` (20/h), `otp-send:id:<channel>:<value>` (3/10 min),
`otp-verify:ip:<bucket>` (60/h), `otp-verify-fail:<channel>:<value>` (10/24 h).

## Request flow

A mutation, for example `POST /api/auth/otp/verify`:

1. `withErrors` wraps the handler: an `HttpError` becomes `{ error, retryAfterSec? }` with its
   status and `Retry-After`; an `EnvError` becomes 500 `server_misconfigured`; anything else 500
   `internal_error`. Only the error name is logged. Next's control flow is rethrown (`unstable_rethrow`).
2. `assertSameOrigin(req)`: `Origin` must equal the request's origin or `APP_URL`'s (403
   `bad_origin`; a missing or `null` Origin is refused).
3. `readJson(req, Schema)`: 415 unless `application/json`, 413 over 16 KB, 400 `invalid_json` or
   `invalid_request`.
4. The service function gets primitives only: `ipBucket(clientIp(req))` (from `x-real-ip`; IPv6
   by /64), `readSessionToken(req)`, `getDeps().now()`.
5. The route maps the result to `jsonResponse` (`Cache-Control: no-store`) and `Set-Cookie`.

**OTP send** (`sendOtp`): normalise (400 `invalid_identifier`) → resend cooldown (429
`resend_cooldown`, spends no budget) → 20/h per IP → 3/10 min per identifier (429
`rate_limited`) → issue → deliver; a failed delivery deletes the challenge (503
`delivery_failed`). Success is `{ ok: true, resendAfterSec: 30 }` whether or not an account
exists.

**OTP verify** (`verifyOtpAndLogin`): normalise → 60/h per IP → peek the 10-per-24 h failure cap
(429 `too_many_attempts`) → spend an attempt atomically and compare in constant time → only a
mismatch on a live challenge hits the failure counter → flip `consumedAt` (single use) → find or
create the user → revoke any presented session → create a session → clear the failure counter →
audit `auth.login` (a failed audit write is logged, never fails the login). Every code-check
failure (unknown, expired, consumed, exhausted or mismatched code, or a bad identifier) is 400
`invalid_code`; the per-IP limit is 429 `rate_limited` and the lockout 429 `too_many_attempts`,
both with `Retry-After`.

**Session resolution** (`getAuth`): read the 43-character token from the cookie → look up by its
hash → refuse if idle or absolute expiry has passed (and delete it) → touch at most once per
60 s → load the user fresh (a missing user is unauthenticated). `requireRole` also needs
`session.kind === "staff"`.

## Providers container

`getDeps()` builds once per process from env. If any provider is a mock (`mock`, `fake`,
`memory`) and `isMockForbidden()` holds, it throws "Mock providers are not allowed in
production". Real providers (`msg91`, `resend`, `razorpay`, `local`, `blob`) are accepted by the
env schema but throw "not implemented yet" until the N, O and R phases build them. Tests swap
parts with `setDepsForTests({ now, sms, … })` and restore with `resetDepsForTests()`.

## Orders and prescriptions

- `transition(order, event, { at, by })` returns `{ ok, to, entry, effects }` or
  `{ ok: false, error }`. Edges, guards and effects are listed in
  [AGENTS.md](../../AGENTS.md#business-invariants-never-break-these). It is pure: the O phase
  persists it with a conditional update on `{ _id, status: from }`.
- `isRxValidOn(rx, at)`: approved, `rxDate` set, and `rxDate ≤ at < min(validUntil, rxDate + 6
  calendar months in IST)`. The R phase stores `rxDate` as IST midnight through a helper
  (`istMidnight`, carried in `docs/decisions/phase-ca-ledger.md`).
- `nextOrderNumber(now)`: `$inc` on `counters/order-number:<YYMM>` (IST month), formatted
  `AAR-YYMM-NNNNN`.

## Caching

**Now (since #60, #68):** Cache Components and `partialPrefetching` are on (`next.config.ts`:
AVIF/WebP, `images.qualities` 70/75/85). Every GET handler's first statement is
`await connection()`, then `requireDevRoute()` in `src/app/dev/**`; `export const dynamic`,
`revalidate` and `fetchCache` are banned (`src/server/route-config.test.ts`). Int tests mock
`connection()` and `next/cache` through `tests/helpers/next-mocks.ts`.

**Since #68 (pages read these from UI Task 9):**
- Catalogue reads go through `'use cache'` wrappers in
  `src/lib/catalogue/cached.ts`, tagged `catalogue` (plus `catalogue:<kind>:<slug>` for a valid slug), with `cacheLife("hours")` as a backstop.
- `revalidateCatalogue()` calls `revalidateTag("catalogue", { expire: 0 })`, so the next request
  after an MRP, photo, active or category write shows the new value. Phase D's admin writes must
  call it; so does the dev-only `POST /dev/catalogue/revalidate`. A direct DB edit needs a redeploy.
- Pages prerender from the DB at build time, so every Vercel scope needs a reachable, seeded
  database at build; an empty catalogue throws `CatalogueEmptyError` and fails the build.

**Planned:**
- Header auth state is fetched after hydration from `GET /api/auth/session`, so pages stay
  static. Product images are content-hashed, so the CDN can cache them forever.
- Client components (`src/components/**`) import at runtime from `src/server/**` only the pure
  `catalogue/pricing.ts`, `catalogue/search.ts` and `catalogue/order.ts`
  (`src/components/server-imports.test.ts`).
