# Phase C/A/O1 (Catalogue, Auth and Order Domain, server side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The server-side, UI-free half of phases C, A and O1, in 12 PRs. It delivers:
- a validated catalogue with seed and queries;
- OTP login with a rate limiter, database sessions, guards and an append-only audit log;
- enforced preview isolation for mock providers;
- a pure order state machine and an atomic order-number counter.

**Architecture:**
- Logic stays in framework-free `src/server/**`. A route handler checks the Origin, parses with zod, calls one service function and maps the result with `src/server/http.ts`.
- Every write that can race is one atomic single-document operation: rate-limit counters, OTP attempts, single use, sessions, find-or-create user, order counter. Nothing reads and then writes.
- Time is a parameter. Database and domain functions take `now: Date`; routes read `getDeps().now()` once per request. Expiry is decided in code, never by the TTL monitor, so tests use a fake clock and never wait.

**Tech Stack:** Next.js 16.4 route handlers, TypeScript 6.0 strict, `mongodb` 7 + zod 4, `node:crypto` (`randomInt`, `randomBytes`, HMAC-SHA256, SHA-256), `sharp` (image dimensions), Vitest (`unit` node; `int` with `MongoMemoryReplSet`), Playwright (Chromium), GitHub Actions.

**Spec:**
- `/Users/harshi/.claude/plans/pasted-content-id-83b6-leave-them-misty-micali.md`: Stage 5 data model, PR phases C, A and O, security and compliance.
- `docs/requirements.md` §5.1, §5.2, §5.6, §6 and §7, and `PRODUCT.md`. The owner accepted these business rules: Rx valid 6 months; at most 10 per product and 20 packs per order; COD up to ₹5,000; pay first and refund if the Rx is rejected; cancel until packed.
- `data/products.json` (11 products; price = `mrpPaise − 2000`, never stored; default MRP 40400 paise).
- Carried rulings from `/Users/harshi/aarvion/docs/decisions/rulings.md` and `phase-f-ledger.md`:
  - preview isolation is enforced inside `isMockForbidden()`;
  - dev-only routes return `notFound()`;
  - the first auth e2e PR uploads the Playwright report on failure and adds Mongo to the e2e job;
  - `registerIndexes` requires an explicit `name`.
- Code at `main` 55b306f: `src/server/{env,deps}.ts`, `src/server/db/*`, `src/server/providers/*`, `tests/helpers/*`, `vitest.config.ts`.

## Global Constraints

Carried from Phase F:
- Branch `type/short-desc` off up-to-date `main` (`git fetch origin && git switch -c <branch> origin/main`); Conventional Commit PR titles; squash-merge.
- **No `Co-Authored-By` trailer, no "Generated with" lines.**
- PRs stay under ~400 changed lines, excluding lockfile, `data/**`, binary assets and generated shadcn files. Check with `pnpm pr-size origin/main`.
- Every PR adds or updates unit and/or integration tests and passes `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build` locally before push. Show the output in the PR body (template: What / Why / How tested / Risks & rollback).
- Never import-time throw on missing env: env is read lazily via `getEnv()`.
- No secrets in tracked files. `.env.example` lists names only.
- Mongo money values are integer paise.
- Mock providers are forbidden in any of these cases. The e2e production build sets `ALLOW_MOCKS_IN_PROD_BUILD` explicitly.
  - `VERCEL_ENV === "production"`;
  - `NODE_ENV === "production" && !ALLOW_MOCKS_IN_PROD_BUILD`;
  - from Task 10, the target database is the production database `aarvion_prod`.
- Merging:
  - The agent merges a PR itself once all required checks are green (`gh pr merge --squash --delete-branch`). The owner authorised this.
  - Check each required check by name in `gh pr checks`: `lint`, `typecheck`, `unit`, `int`, `build`, `e2e`, `pr-title`. Branch protection is unavailable (`docs/decisions/repo.md`).
  - No force-pushes; a stacked PR is redone as a fresh branch.

New in this phase:
- **Business values, used verbatim:**
  - selling price = `mrpPaise − 2000`, with `mrpPaise ≥ 2100`; default MRP `40400`;
  - OTP: 6 digits, 5-minute expiry, 5 attempts, single use, 30 s resend cooldown;
  - send limits: 3 per 10 min per identifier, 20 per hour per IP;
  - customer session: 30-day sliding; staff session: 12 h absolute and 30 min idle;
  - Rx valid 6 months; cancel until packed;
  - order number `AAR-YYMM-NNNNN`.
- **Time:** new code in `src/server/**` never calls `new Date()` or `Date.now()`. The `deps.ts` default and the Phase F outbox are the only existing uses. Domain and database functions take `now: Date`. Tests drive the clock with `setDepsForTests({ now })` or explicit `now` arguments.
- **Atomicity:** counters, attempts, limits and single-use flags change with single-document `$inc`, conditional updates or upserts. On an E11000 from a concurrent upsert, retry once.
- **Indexes:**
  - every `registerIndexes` spec carries an explicit `name` (enforced in Task 2);
  - every module that registers indexes is imported by `src/server/db/register-all.ts` (Task 2 test);
  - to change an index, rename it; never change one in place (`docs/decisions/db.md`).
- **Routes:**
  - Read cookies from `req.headers`. Write them with `Set-Cookie` on the returned `Response`. Never use `cookies()` from `next/headers` in route handlers: int tests call handlers directly, with no request scope.
  - Every POST/PUT/PATCH/DELETE handler calls `assertSameOrigin(req)` first.
  - Every auth response carries `Cache-Control: no-store`.
  - GET handlers export `dynamic = "force-dynamic"`.
- **Dev-only routes** live under `src/app/dev/**` and call `requireDevRoute()` first (Task 10 test).
- **Inputs** reach Mongo only as zod-parsed primitives. No user input becomes a regex or an operator object.
- **Logs** record error names only. Never log OTP codes, session tokens, full phone numbers or emails, or prescription content.
- **Public catalogue data** never includes `internalNotes`. `pricePaise` is derived with `sellingPricePaise()` at read time.
- **Int test isolation:** each int test file starts its own replica set (`tests/helpers/mongo.ts`). Files that need unique or TTL indexes import `@/server/db/register-all` and call `ensureIndexes(await getDb())` in `beforeAll`.

## Review Focus
1. **Two verify calls racing with the right code** (double tap, a 4G retry, or autofill plus a tap). Exactly one returns 200 and creates a session; the other returns 400 `invalid_code`; one session row exists. Tests: Task 5 (5 parallel `verifyOtpChallenge`) and Task 8 (2 parallel POSTs).
2. **Brute force across fresh challenges** (send, 5 guesses, resend, 5 more…). Attempts reset with each new challenge. A per-identifier cap of 10 failed verifies per 24 h therefore returns 429 `too_many_attempts`, even for the right code. Test: Task 8.
3. **SMS pumping and resend spam.** Test: Task 4 (`ipBucket`) and Task 7.
   - A non-Indian or non-mobile number gets 400 before any limiter runs or any SMS is sent.
   - IPv6 addresses rotating within one /64 share one 20-per-hour bucket.
   - Resend taps during the 30 s cooldown return 429 `resend_cooldown` without using the 3-per-10-minute budget.
   - A provider outage does not lock the user out for 30 s.
4. **Session fixation and stale privilege.** Tests: Task 8 and Task 9.
   - Logging in while any session cookie is present creates a new token and deletes the old session.
   - A 30-day customer session whose user is promoted to staff is refused by `requireRole` until the user logs in again.
   - Staff cookies carry no `Max-Age`.
5. **Expiry boundaries on a fake clock, while the expired document still exists.** Each case below is decided in code from `now`, with the expired document still present. Tests: Tasks 4, 5, 6, 11 and 12.
   - an OTP at exactly 5:00;
   - a rate-limit window at exactly 10:00;
   - a staff session at exactly 30:00 idle and at exactly 12:00:00 absolute;
   - a customer session at exactly 30 days;
   - an Rx at exactly 6 months;
   - the order-number month at the IST month rollover.

## Decisions taken in this plan (rulings; override any)

**Environments and isolation**
- **Production DB name:** the constant `PRODUCTION_DB_NAME = "aarvion_prod"`.
  - `isMockForbidden()` compares it, ignoring case, with `MONGODB_DB` and with the database in the `MONGODB_URI` path.
  - Production must set `MONGODB_DB=aarvion_prod`.
  - Cost if wrong: one constant and one Vercel variable.

**Catalogue**
- **Images:**
  - Photos are served at `public/products/<slug>/<sha256-8>.webp` and cutouts at `public/products/<slug>/cutout-<sha256-8>.webp`. Both are generated by `pnpm images:sync`, which writes `data/product-images.json`.
  - The hero image is first in `images[]`. Alt text is generated.
  - Content hashing busts caches when a Win2Age photo is swapped.
- **Seed** inserts missing documents only (`$setOnInsert`), so a re-run never reverts admin edits to MRP, photos or category status. Cost: resetting dev data means dropping the database.
- **Enums:**
  - `imageSource` = `aarvion | win2age | unbranded | placeholder`. `products.json` uses `unbranded` for Caftop.
  - `schedule` = `H | H1 | G | OTC`, and `H`/`H1` require `rxRequired: true`.
- **Category status:**
  - Only products in `live` categories are public: in lists, search, slug lookups and families.
  - `coming_soon` categories list no products.
  - `hidden` categories resolve to `null`, and the page 404s.
- **Search and variants:**
  - Search matches in memory: every normalised query token must occur in name + family + ingredients. No regex is used.
  - A query that normalises to nothing returns `[]`. Queries are capped at 64 characters.
  - The variant switcher orders by the leading number in `variantLabel`.
  - Caching (`"use cache"` with tags) belongs to the page layer (C3), not `src/server`.
- **Not added here:** country of origin is not in `products.json` (C4 decides). The quantity caps (10 per product, 20 per order) and the COD cap (₹5,000) are enforced by K1 and O2.

**PR split**
- **A4 split:** A4 is split into three PRs. The users and sessions store lands before A3, because verify creates a session. Guards, me, logout and audit come next, then preview isolation, dev outbox and e2e.
- **A3 split:** A3 is split into send and verify to stay under 400 lines.

**OTP login**
- **Brute-force cap:** 10 failed verifies per identifier per 24 h (not in the spec).
- **Send order:**
  1. Validate.
  2. Resend cooldown (uses no budget).
  3. Per-IP limit (20/h).
  4. Per-identifier limit (3/10 min).
  5. Issue.
  6. Deliver. A delivery failure deletes the challenge.
- **Client IP:** taken from `x-real-ip` (set by Vercel). IPv6 is bucketed by /64.
- **OTP message copy:**
  - Email subject `Your Aarvion login code`; text `<code> is your Aarvion login code. It expires in 5 minutes. Aarvion staff will never ask you for this code.`
  - SMS `templateId: "otp"`, `vars: { code, minutes: "5" }`. The DLT wording lives in MSG91 (N phase).
- **Consent:** DPDP consent and the 18+ declaration are captured by the login UI PR (A5), which extends verify for new accounts. No real users exist before then.

**Sessions and requests**
- **Origin:** a mutation's `Origin` must equal the request's own origin or the origin of `APP_URL`. A missing or `null` Origin gets 403. JSON bodies require `Content-Type: application/json` (otherwise 415).
- **Cookie:**
  - `__Host-aarv_sid; Path=/; Secure; HttpOnly; SameSite=Lax`.
  - Customer cookies carry `Max-Age=2592000`, re-issued by `GET /api/auth/me` when the session slides. Staff cookies carry no `Max-Age`.
  - Sessions are touched at most once per 60 s.
- **Staff roles:** `requireRole` for staff roles also requires a staff-kind session.
- **Dev outbox:** `/dev/outbox` is a JSON route handler (`GET /dev/outbox?to=`), not a page, to keep this phase UI-free.

**CI**
- **E2E Mongo:** the e2e job gets Mongo through `pnpm db:up` (the docker-compose replica set). A `services:` container cannot pass `--replSet`.
  - The job uses `MONGODB_DB=aarvion_e2e` and a random `OTP_PEPPER` per run.

**Orders**
- **Rx validity:** 6 calendar months from the Rx date, counted in IST, with an exclusive end.
  - A pharmacist-entered `validUntil` is capped at that date.
  - "Valid on the order date" is checked against the order's `createdAt`.
- **State machine:**
  - `on_hold → confirmed` is allowed when a new Rx is approved, but a refunded prepaid order then fails with `payment_required`.
  - `ship` re-checks the Rx and payment guards.
  - `hold` or `cancel` on a paid order returns the effect `refund`.
  - Every actor can cancel from `pending_payment`, `placed`, `on_hold` and `confirmed`.
- **Order number:** `YYMM` is the IST month. The sequence restarts each month and has at least 5 digits, never truncated.

## File Structure
```
src/server/catalogue/      schema.ts pricing.ts categories.ts collections.ts seed.ts search.ts queries.ts
src/server/security/       rate-limit.ts client-ip.ts origin.ts
src/server/http.ts         HttpError, jsonResponse, readJson, withErrors
src/server/auth/           identifier.ts otp.ts users.ts sessions.ts cookie.ts login.ts guards.ts
src/server/audit.ts        append-only audit writer
src/server/dev-only.ts     requireDevRoute()
src/server/orders/         status.ts order-number.ts
src/server/prescriptions/  validity.ts
src/app/api/auth/          otp/send/route.ts otp/verify/route.ts me/route.ts logout/route.ts
src/app/dev/outbox/route.ts
scripts/                   sync-product-images.ts seed.ts
data/product-images.json   generated; public/products/<slug>/*.webp generated
tests/helpers/             clock.ts http.ts otp.ts (+ clearCollections in mongo.ts)
e2e/auth.spec.ts
```
New collections: `products`, `categories`, `rate_limits`, `otp_challenges`, `users`, `sessions`, `audit_logs`, `counters`.

**Order and parallelism:**
- Catalogue: Tasks 1 → 2 → 3.
- Auth: Tasks 4 → 5 → 6 → 7 → 8 → 9 → 10 (the critical path).
- Orders: Tasks 11 and 12 are independent.

The three chains can run in parallel. `register-all.ts` is touched by Tasks 2, 4, 5, 6 and 9, so rebase on `main` before each push.

---

### Task 1: Catalogue schema, pricing and product images (PR `feat/catalogue-schema-images`, spec C1 part 1)

**Files:**
- Create: `src/server/catalogue/pricing.ts`, `src/server/catalogue/schema.ts`, `src/server/catalogue/categories.ts`, `scripts/sync-product-images.ts`.
- Generate and commit: `public/products/<slug>/<hash8>.webp`, `public/products/<slug>/cutout-<hash8>.webp`, `data/product-images.json`.
- Modify: `package.json` (add `"images:sync": "tsx scripts/sync-product-images.ts"`).
- Test: `src/server/catalogue/pricing.test.ts`, `src/server/catalogue/schema.test.ts`, `scripts/sync-product-images.test.ts`.

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `pricing.ts`:
    - constants `MRP_DISCOUNT_PAISE = 2000`, `MIN_MRP_PAISE = 2100`, `DEFAULT_MRP_PAISE = 40400`;
    - `sellingPricePaise(mrpPaise: number): number`, which throws `RangeError` unless `mrpPaise` is a safe integer ≥ 2100.
  - `schema.ts` (zod 4; each exported schema also exports its inferred type of the same name):
    - `CATEGORY_SLUGS = ["cardiology","diabetology","ophthalmology","respiratory","gastroenterology","orthopaedics","urology","pain-management"] as const`; `type CategorySlug`.
    - `CategoryStatus = z.enum(["live","coming_soon","hidden"])`; `Category = z.object({ slug: z.enum(CATEGORY_SLUGS), name, status: CategoryStatus, sortOrder: int })`.
    - `Slug = z.string().max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`; `CompositionItem = { ingredient, strength }`.
    - `ProductImage = { src: /^\/products\/[a-z0-9-]+\/(cutout-)?[0-9a-f]{8}\.webp$/, width: int>0, height: int>0, alt: min(1) }`.
    - `ImageSource = enum(["aarvion","win2age","unbranded","placeholder"])`; `Schedule = enum(["H","H1","G","OTC"])`.
    - `ProductJson`: a `z.strictObject` with exactly the 20 keys of a `products.json` entry, where:
      - `mrpPaise` is `int ≥ 2100`, nullable;
      - `mrpSource` is `enum(["pack-back-panel","default"])`;
      - `heroImage ∈ images`;
      - `H`/`H1` ⇒ `rxRequired`.
    - `CatalogueJson = strictObject({ _comment?: string, defaultMrpPaise: literal(40400), products: ProductJson[] with unique slugs })`.
    - `Product` (the database document) has these fields, with the same `H`/`H1` ⇒ `rxRequired` refinement:
      - `slug`, `name`, `familySlug`, `variantLabel: string|null`, `category: CategorySlug`;
      - `composition: CompositionItem[] (min 1)`, `dosageForm`, `packLabel`;
      - `mrpPaise: int ≥ 2100`, `mrpSource: enum(["pack-back-panel","default","admin"])`, `schedule`, `rxRequired`;
      - `manufacturer: string|null`, `marketer`;
      - `images: ProductImage[] (min 1, hero first)`, `cutout: ProductImage|null`, `imageSource`;
      - `active`, `sortOrder: int`, `internalNotes: string|null`, `createdAt: Date`, `updatedAt: Date`.
  - `categories.ts`: `CATEGORY_LIST: readonly Category[]`, exactly:

    | slug | name | status | sortOrder |
    |---|---|---|---|
    | cardiology | Cardiology | live | 1 |
    | diabetology | Diabetology | live | 2 |
    | ophthalmology | Eye care | live | 3 |
    | respiratory | Respiratory | live | 4 |
    | gastroenterology | Gastroenterology | coming_soon | 5 |
    | orthopaedics | Orthopaedics | coming_soon | 6 |
    | urology | Urology | coming_soon | 7 |
    | pain-management | Pain Management | hidden | 8 |
  - `scripts/sync-product-images.ts`:
    - `type ManifestImage = { src: string; width: number; height: number; from: string }`;
    - `type ImageManifest = Record<string, { photos: ManifestImage[]; cutout: ManifestImage | null }>`;
    - `planImageSync(catalogue: CatalogueJson, repoRoot: string): Promise<{ manifest: ImageManifest; copies: { from: string; to: string }[] }>`.

- [ ] **Step 1: Write the failing tests**
  - `pricing.test.ts`:
    - `sellingPricePaise(28100) === 26100`, `(2100) === 100`, `(40400) === 38400`;
    - `it.each([2099, 0, -2000, 28100.5, NaN, Infinity])` throws `RangeError`;
    - `it("prices every listed product at MRP − ₹20")`: for each product in `data/products.json`, the price equals this map from the spec table:
      - `{ "sacuwin-50": 26100, "sacuwin-100": 38700, "sacuwin-200": 27000, "bemptor-180": 36000, "bemptor-r40": 61000 }`;
      - `{ "vildage-m-50-500": 16500, "hyloage": 40500, "sysnet-ultra": 39600, "caftop": 24300, "oloage-kt": 18900, "mucohelp": 18900 }`.
  - `schema.test.ts`:
    - `CatalogueJson.parse(<data/products.json>)` gives 11 products with unique slugs. The set of categories equals `{cardiology, diabetology, ophthalmology, respiratory}`.
    - `it.each` rejects a `ProductJson` (start from the sacuwin-50 entry) for each of: `mrpPaise: 2099`; an extra key `price: 26100`; a `heroImage` not in `images`; `{ schedule: "H", rxRequired: false }`; `slug: "Sacuwin 50"`; `category: "dermatology"`.
    - It accepts `mrpPaise: null`.
    - `CATEGORY_LIST` deep-equals the table above. `live` slugs = `[cardiology, diabetology, ophthalmology, respiratory]`; `coming_soon` = `[gastroenterology, orthopaedics, urology]`; `hidden` = `[pain-management]`.
    - `Product` rejects `images[0].src = "/assets/x.webp"`.
  - `scripts/sync-product-images.test.ts`:
    - `planImageSync(catalogue, cwd)` gives a `manifest` that deep-equals the committed `data/product-images.json`. A changed photo without a re-run of `pnpm images:sync` therefore fails CI.
    - Every `copies[].to` exists.
    - `manifest["sacuwin-50"].photos` has length 3; `manifest.mucohelp.photos` has length 2. Photo `src` matches `^/products/<slug>/[0-9a-f]{8}\.webp$` and cutout `src` matches `^/products/<slug>/cutout-[0-9a-f]{8}\.webp$`.
    - `manifest["sacuwin-50"].photos[0]` has `width` 1000 and `height` 1000.
    - Photos keep the `products.json` order, and `from` is the source path.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/catalogue scripts/sync-product-images.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `pricing.ts`, `schema.ts` and `categories.ts`. Then implement `sync-product-images.ts`:
  - `hash8` = the first 8 hex characters of the SHA-256 of the file bytes. Dimensions come from `sharp(buf).metadata()`.
  - Cutouts come from `assets/products/cutout/<slug>.webp`, or `null` when absent.
  - The CLI (guarded by `process.argv[1] === fileURLToPath(import.meta.url)`, as in `pr-size.ts`):
    - copies any missing targets;
    - deletes files under `public/products/<slug>/` that are not in the plan, and folders of slugs that are gone;
    - writes the manifest as 2-space JSON with a trailing newline.
  - Run `pnpm images:sync` twice. The second run leaves `git status --porcelain public data` empty.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full gate from Global Constraints.
- [ ] **Step 5: Commit** in two commits:
  - `feat(catalogue): add product and category schemas with MRP-minus-20 pricing`;
  - `feat(catalogue): serve content-hashed product images from public/products`.

  PR title: `feat(catalogue): add catalogue schema, pricing and product images`.

### Task 2: Explicit index names and catalogue seed (PR `feat/catalogue-seed`, spec C1 part 2)

**Files:**
- Modify: `src/server/db/indexes.ts`, `src/server/db/register-all.ts`, `package.json`, `README.md`.
  - `package.json` adds `"seed": "tsx --env-file-if-exists=.env.local scripts/seed.ts"`.
  - `README.md` adds the dev line `pnpm db:up && pnpm db:indexes && pnpm seed`.
- Create: `src/server/catalogue/collections.ts`, `src/server/catalogue/seed.ts`, `scripts/seed.ts`.
- Test: `src/server/db/indexes.test.ts`, `src/server/db/register-all.test.ts`, `src/server/catalogue/seed.test.ts`, `tests/int/seed.test.ts`.

**Interfaces:**
- Consumes: from Task 1, `ProductJson`, `CatalogueJson`, `Product`, `Category`, `CATEGORY_LIST`, `ImageManifest` and `DEFAULT_MRP_PAISE`. From Phase F, `getDb()`, `closeMongo()` and `ensureIndexes()`.
- Produces:
  - `type NamedIndex = IndexDescription & { name: string }`.
  - `registerIndexes(collection: string, specs: NamedIndex[]): void`. It:
    - throws `/explicit name/` when a spec has no non-empty `name`;
    - ignores an identical re-registration (HMR);
    - throws `/already registered/` when a name is reused in the collection with a different spec (compared with `JSON.stringify`).
  - `getRegisteredIndexes(collection: string): readonly NamedIndex[]`. `ensureIndexes` uses `spec.name`, and `specName()` is deleted.
  - `PRODUCTS_COLLECTION = "products"` and `CATEGORIES_COLLECTION = "categories"`. Each registers `{ key: { slug: 1 }, name: "slug_unique", unique: true }`.
  - `toProductDoc(p: ProductJson, images: ImageManifest[string], defaultMrpPaise: number, now: Date): Product`.
    - The hero image moves to `images[0]`.
    - Photo alt text is `` `${name} pack, photo ${i} of ${n}` `` (numbered in the final order); cutout alt text is `` `${name} pack` ``.
    - When `mrpPaise` is null, it becomes `defaultMrpPaise` and `mrpSource` becomes `"default"`.
    - `notes` becomes `internalNotes`.
  - `type SeedReport = { categories: { inserted: number; existing: number }; products: { inserted: number; existing: number } }`.
  - `seedCatalogue(db: Db, input: { categories: readonly Category[]; products: Product[] }, now: Date): Promise<SeedReport>`.
  - CLI `pnpm seed`:
    - prints `categories: <i> inserted, <e> existing` and `products: <i> inserted, <e> existing`;
    - exits 1 and names the slug when a product is missing from `data/product-images.json`.

- [ ] **Step 1: Write the failing tests for index names**
  - `indexes.test.ts` (call `resetIndexRegistryForTests()` in `beforeEach`):
    - `registerIndexes("x", [{ key: { a: 1 } } as NamedIndex])` throws `/explicit name/`, and so does `name: ""`.
    - Registering `{ key: { a: 1 }, name: "a_1" }` twice leaves `getRegisteredIndexes("x")` with length 1.
    - `{ key: { b: 1 }, name: "a_1" }` after it throws `/already registered/`.
  - `register-all.test.ts`:
    - collect every non-test file under `src/server/**/*.ts` (`fs.globSync`), except `db/indexes.ts`, whose source contains `registerIndexes(`;
    - assert that `register-all.ts` contains an import of each, by its relative path, for example `"../providers/outbox.ts"`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/db`. Expected: FAIL (`getRegisteredIndexes` missing; no throw on a missing name).
- [ ] **Step 3: Implement** the `indexes.ts` changes.
- [ ] **Step 4: Run** `pnpm exec vitest run --project unit src/server/db && pnpm exec vitest run --project int tests/int/db.test.ts tests/int/db-indexes-script.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor(db): require explicit index names in registerIndexes`.
- [ ] **Step 6: Write the failing tests for the seed**
  - `seed.test.ts` (unit; manifest read from `data/product-images.json`):
    - sacuwin-50 maps to: `mrpPaise: 28100`, `mrpSource: "pack-back-panel"`, `images.length: 3`, `images[0].src === manifest["sacuwin-50"].photos[0].src`, `images[0].alt === "Sacuwin 50 pack, photo 1 of 3"`, `cutout.alt === "Sacuwin 50 pack"`, `internalNotes: null`, `createdAt === updatedAt === now`.
    - With `heroImage` set to the third photo, `images[0].src` is `photos[2].src`.
    - `mrpPaise: null` gives `mrpPaise: 40400` and `mrpSource: "default"`.
    - bemptor-r40 has `internalNotes` equal to its `notes` in `products.json`.
    - All 11 products produce documents that pass `Product.parse`.
  - `tests/int/seed.test.ts`:
    - The first `seedCatalogue` returns `{ categories: { inserted: 8, existing: 0 }, products: { inserted: 11, existing: 0 } }`. The second returns `{ categories: { inserted: 0, existing: 8 }, products: { inserted: 0, existing: 11 } }`. Counts are 8 and 11.
    - **Admin edits survive a re-run:** set sacuwin-100 to `mrpPaise: 41000` and `mrpSource: "admin"`, re-seed, and it is still 41000.
    - After `ensureIndexes`, `products` has `slug_unique` with `unique: true`.
    - `spawnSync("pnpm", ["seed"])` with `MONGODB_DB=seed_script_test` exits 0 and stdout contains `products: 11 inserted`. A second spawn prints `products: 0 inserted, 11 existing`.
- [ ] **Step 7: Run** `pnpm exec vitest run --project unit src/server/catalogue/seed.test.ts && pnpm exec vitest run --project int tests/int/seed.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 8: Implement**:
  - `collections.ts`, imported from `register-all.ts`;
  - `seed.ts`: one `bulkWrite` per collection of `updateOne({ slug }, { $setOnInsert: doc }, { upsert: true })`. The report comes from `upsertedCount` and `matchedCount`. There is never a `$set`.
  - `scripts/seed.ts`: parse `CatalogueJson` and the manifest, map with `toProductDoc`, seed `CATEGORY_LIST`, print the report, and call `closeMongo()`.
- [ ] **Step 9: Run** the Step 7 command (expected: PASS), then the full gate.
- [ ] **Step 10: Commit** `feat(catalogue): add idempotent seed that never overwrites existing documents`.

  PR title: `feat(catalogue): add catalogue seed and require explicit index names`.

### Task 3: Catalogue queries (PR `feat/catalogue-queries`, spec C2)

**Files:**
- Create: `src/server/catalogue/search.ts`, `src/server/catalogue/queries.ts`.
- Modify: `src/server/catalogue/collections.ts` (two indexes).
- Test: `src/server/catalogue/search.test.ts`, `tests/int/catalogue-queries.test.ts`.

**Interfaces:**
- Consumes: from Task 1, `Product`, `Category`, `Slug` and `sellingPricePaise`. From Task 2, `PRODUCTS_COLLECTION`, `CATEGORIES_COLLECTION`, `seedCatalogue` and `toProductDoc`.
- Produces:
  - `MAX_QUERY_LENGTH = 64`.
  - `normaliseSearchText(s: string): string`: NFKD, strip combining marks, lowercase, replace each non-`[a-z0-9]` run with one space, trim.
  - `queryTokens(q: string): string[]`: normalise, cut to 64 characters, split on spaces, drop empty tokens.
  - `matchesTokens(p: Pick<Product, "name" | "familySlug" | "composition">, tokens: string[]): boolean`. Every token must be a substring of the haystack: the space-free normalised text of `[name, familySlug, ...ingredients]`.
  - `type PublicProduct = Omit<Product, "internalNotes" | "mrpSource" | "createdAt" | "updatedAt"> & { id: string; pricePaise: number }`.
  - `listVisibleCategories(): Promise<Category[]>`: `live` and `coming_soon`, by `sortOrder`.
  - `getCategoryBySlug(slug: string): Promise<Category | null>`: `null` for hidden or unknown slugs.
  - `listProducts(opts?: { category?: string; q?: string }): Promise<PublicProduct[]>`.
  - `getProductBySlug(slug: string): Promise<PublicProduct | null>`.
  - `getFamily(familySlug: string): Promise<PublicProduct[]>`.
  - New indexes on `products`:
    - `{ category: 1, active: 1, sortOrder: 1 }` named `category_active_sortOrder`;
    - `{ familySlug: 1, active: 1 }` named `familySlug_active`.

- [ ] **Step 1: Write the failing tests**
  - `search.test.ts`:
    - `queryTokens("  Sacu WIN ")` → `["sacu","win"]`; `("Bemptor-R40")` → `["bemptor","r40"]`; `("Valsártan")` → `["valsartan"]`; `(".*")` → `[]`; `("^s$")` → `["s"]`; `("a".repeat(100))` → `["a".repeat(64)]`.
    - `matchesTokens` on sacuwin-100 is true for `["sacuwin","100"]`, `["sacu","valsartan"]` and `["sacubitril","valsartan"]`, and false for `["metformin"]` and `["24"]`.
  - `tests/int/catalogue-queries.test.ts` (seeded from the real data via `toProductDoc` and `seedCatalogue`):
    - `listProducts()` returns 11 products, from `bemptor-r40` first to `mucohelp` last. Every one has `pricePaise === mrpPaise - 2000`, and none has an `internalNotes` or `mrpSource` key.
    - `listProducts({ category: "ophthalmology" })` → slugs `["hyloage","sysnet-ultra","caftop","oloage-kt"]`. `{ category: "urology" }` → `[]`; `{ category: "nope" }` → `[]`.
    - Search:
      - `{ q: "sacu" }` and `{ q: "valsartan" }` each return the 3 Sacuwin products;
      - `{ q: "SACUWIN 100" }` → `["sacuwin-100"]`; `{ q: "bemptor-r40" }` → `["bemptor-r40"]`;
      - `{ q: "eye drops" }` returns 4; `{ q: ".*" }` → `[]`;
      - `{ q: "metformin", category: "cardiology" }` → `[]`.
    - `getProductBySlug("sacuwin-100")` returns `name: "Sacuwin 100"` and `pricePaise: 38700`. `("SACUWIN-100")` → `null`; `("nope")` → `null`. After `active: false` → `null`. After moving the product to `category: "urology"` → `null`, and it is also missing from `listProducts({ q: "sacuwin" })`.
    - `getFamily("sacuwin")` → `["sacuwin-50","sacuwin-100","sacuwin-200"]`; `getFamily("bemptor")` → `["bemptor-180","bemptor-r40"]`.
    - `listVisibleCategories()` returns 7 slugs in `sortOrder`, without `pain-management`. `getCategoryBySlug("pain-management")` → `null`. `getCategoryBySlug("ophthalmology")?.name` is `"Eye care"`.
    - After `ensureIndexes`, `products` has `category_active_sortOrder` and `familySlug_active`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/catalogue/search.test.ts && pnpm exec vitest run --project int tests/int/catalogue-queries.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement**:
  - `listProducts`:
    - reads the `live` slugs from `categories`;
    - returns `[]` without querying products when `category` is given but not live, or when `q` is given and `queryTokens(q)` is empty;
    - otherwise runs `find({ active: true, category: category ?? { $in: live } }).sort({ sortOrder: 1, name: 1 })` and filters with `matchesTokens` in memory.
  - `getFamily` sorts by `Number.parseInt(variantLabel)` ascending (NaN or null last), then by `name`.
  - Slug arguments that fail `Slug` return `null` or `[]` without a query.
  - `toPublicProduct` (module-private) drops `_id`, `internalNotes`, `mrpSource`, `createdAt` and `updatedAt`, and adds `id` and `pricePaise`.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full gate.
- [ ] **Step 5: Commit** `feat(catalogue): add product list, literal search, family and category queries`.

### Task 4: Rate limiter and client IP (PR `feat/rate-limiter`, spec A1)

**Files:**
- Create: `src/server/security/rate-limit.ts`, `src/server/security/client-ip.ts`.
- Modify: `src/server/db/register-all.ts`.
- Test: `tests/int/rate-limit.test.ts`, `src/server/security/client-ip.test.ts`.

**Interfaces:**
- Consumes: from Phase F, `getDb()` and `registerIndexes()`.
- Produces:
  - `RATE_LIMITS_COLLECTION = "rate_limits"`, with the index `{ key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 }`.
  - `type RateLimitInput = { key: string; limit: number; windowMs: number; now: Date }`.
  - `type RateLimitResult = { allowed: boolean; count: number; limit: number; resetAt: Date; retryAfterSec: number }`.
  - `hitRateLimit(i: RateLimitInput): Promise<RateLimitResult>`: increments the counter. `allowed` is `count <= limit`.
  - `peekRateLimit(i: RateLimitInput): Promise<RateLimitResult>`: never writes. `allowed` is `count < limit`; `count` is 0 for a missing or expired window.
  - `retryAfterSec` is `ceil((resetAt − now) / 1000)` when not allowed, and 0 otherwise.
  - `clientIp(req: Request): string`: `x-real-ip`, else the first `x-forwarded-for` entry, else `"unknown"`, trimmed.
  - `ipBucket(ip: string): string`:
    - IPv4 is returned unchanged;
    - IPv4-mapped IPv6 returns the IPv4 address;
    - other IPv6 addresses return the first 4 hextets, expanded and lowercased, plus `"::/64"`;
    - anything else returns `"unknown"`.

- [ ] **Step 1: Write the failing tests**
  - `client-ip.test.ts`:
    - `x-real-ip: 203.0.113.7` → `"203.0.113.7"`;
    - with only `x-forwarded-for: 198.51.100.1, 10.0.0.1` → `"198.51.100.1"`;
    - with neither header → `"unknown"`.
    - `ipBucket("2001:db8:abcd:12:1:2:3:4")` and `ipBucket("2001:DB8:abcd:12::99")` both → `"2001:db8:abcd:12::/64"`; `("2001:db8:abcd:13::1")` differs.
    - `ipBucket("::ffff:203.0.113.7")` → `"203.0.113.7"`; `ipBucket("not-an-ip")` → `"unknown"`.
  - `tests/int/rate-limit.test.ts` (T = `2026-11-17T04:30:00Z`, window 600_000):
    - Three hits at T are allowed with counts 1, 2, 3. The 4th returns `{ allowed: false, count: 4, retryAfterSec: 600 }`, and `resetAt` is T + 600_000.
    - A hit at T + 599_999 is in the same window. At T + 600_000, the document from the old window still exists (`findOne` is not null), yet the hit returns `count: 1, allowed: true` (the query-time check).
    - `Promise.all` of 50 hits on a fresh key with limit 20 gives exactly 20 `allowed`, and the final count is 50.
    - `peekRateLimit` on a new key → `{ count: 0, allowed: true }`, and no document is created. After 2 hits, a peek with limit 2 → `{ count: 2, allowed: false }`.
    - Keys are independent.
    - After `ensureIndexes`, `rate_limits` has `expiresAt_ttl` with `expireAfterSeconds: 0`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/security && pnpm exec vitest run --project int tests/int/rate-limit.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The window starts at the first hit and resets atomically inside one pipeline upsert, which is also the query-time check:

```ts
const expired = { $or: [{ $eq: [{ $type: "$expiresAt" }, "missing"] }, { $lte: ["$expiresAt", now] }] };
await col.findOneAndUpdate(
  { _id: key },
  [{ $set: {
    count: { $cond: [expired, 1, { $add: ["$count", 1] }] },
    expiresAt: { $cond: [expired, new Date(now.getTime() + windowMs), "$expiresAt"] },
  } }],
  { upsert: true, returnDocument: "after" },
); // retry once on E11000 (two first hits racing the insert)
```
  - Use `node:net` `isIPv4` and `isIPv6` for `ipBucket`. Register `rate-limit.ts` in `register-all.ts`.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full gate.
- [ ] **Step 5: Commit** `feat(security): add Mongo fixed-window rate limiter and client IP buckets`.

### Task 5: OTP challenges (PR `feat/otp-challenges`, spec A2)

**Files:**
- Create: `src/server/auth/identifier.ts`, `src/server/auth/otp.ts`.
- Modify:
  - `src/server/env.ts`: add `OTP_PEPPER: z.preprocess(emptyToUndefined, z.string().min(32).optional())` and `requireEnv`;
  - `src/server/env.test.ts`;
  - `.env.example`: add `OTP_PEPPER=` with the comment `# 64 hex chars: openssl rand -hex 32`;
  - `src/server/db/register-all.ts`.
- Test: `src/server/auth/identifier.test.ts`, `src/server/auth/otp.test.ts`, `tests/int/otp.test.ts`.

**Interfaces:**
- Consumes: from Phase F, `getEnv()`, `EnvError`, `getDb()` and `registerIndexes()`.
- Produces:
  - `requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]>`: throws `EnvError` naming the key when it is unset.
  - `type Channel = "phone" | "email"` and `type Identifier = { channel: Channel; value: string }`.
  - `normalizePhone(raw: string): string | null`:
    1. Strip spaces, `-`, `(` and `)`.
    2. Accept `+91XXXXXXXXXX`, `91XXXXXXXXXX`, `0XXXXXXXXXX` or `XXXXXXXXXX`.
    3. The 10 digits must match `^[6-9]\d{9}$`.
    4. Return `+91XXXXXXXXXX`.
  - `normalizeEmail(raw: string): string | null`: trim, lowercase, `z.email()`, at most 254 characters. Plus-addressing is kept.
  - `normalizeIdentifier(channel: Channel, raw: string): Identifier | null`; `identifierKey(id: Identifier): string`, which returns `` `${channel}:${value}` ``.
  - Constants `OTP_COLLECTION = "otp_challenges"`, `OTP_TTL_MS = 300_000`, `OTP_MAX_ATTEMPTS = 5`, `OTP_RESEND_COOLDOWN_MS = 30_000`.
  - The index `{ key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 }`.
  - The document: `{ _id: identifierKey; challengeId: string (uuid); codeHash: string; attempts: number; createdAt; expiresAt; resendAvailableAt; consumedAt: Date | null }`. It holds one live challenge per identifier, and a new send replaces the old one.
  - `generateOtpCode(): string`: `crypto.randomInt(0, 1_000_000)` padded to 6 digits.
  - `hashOtp(i: { challengeId: string; identifier: Identifier; code: string }): string`: HMAC-SHA256 with `requireEnv("OTP_PEPPER")` over `` `${challengeId}:${channel}:${value}:${code}` ``, as hex.
  - `resendCooldownSec(id: Identifier, now: Date): Promise<number>`: 0 when a resend is allowed.
  - `type IssueResult = { ok: true; code: string; challengeId: string; expiresAt: Date } | { ok: false; reason: "cooldown"; retryAfterSec: number }`.
  - `issueOtpChallenge(id: Identifier, now: Date): Promise<IssueResult>`.
  - `cancelOtpChallenge(id: Identifier, challengeId: string): Promise<void>`.
  - `type VerifyResult = { ok: true } | { ok: false; reason: "no_active_challenge" | "mismatch" | "consumed_concurrently" }`.
  - `verifyOtpChallenge(id: Identifier, code: string, now: Date): Promise<VerifyResult>`.

- [ ] **Step 1: Write the failing tests**
  - `identifier.test.ts`:
    - These all give `"+919876543210"`: `"9876543210"`, `"+91 98765 43210"`, `"09876543210"`, `"919876543210"`, `"+91-98765-43210"`, `"(+91) 98765 43210"`.
    - These give `null`: `"5876543210"`, `"98765"`, `"+1 2025550123"`, `"+9198765432101"`, `""`.
    - `normalizeEmail("  Asha.Rao@Example.COM ")` → `"asha.rao@example.com"`; `"asha+rx@example.com"` is unchanged; `"not-an-email"`, `"a@localhost"` and a 255-character address → `null`.
    - `normalizeIdentifier("phone", "a@b.com")` and `("email", "9876543210")` → `null`.
  - `otp.test.ts` (unit; set `OTP_PEPPER` with `vi.stubEnv` and `resetEnvForTests`):
    - 1000 `generateOtpCode()` calls all match `/^\d{6}$/`.
    - `hashOtp` is a stable 64-character hex string. It changes when `challengeId`, `code` or the pepper changes.
    - With `OTP_PEPPER` unset, it throws `/OTP_PEPPER/`. A 31-character pepper makes `getEnv()` throw `/OTP_PEPPER/`.
  - `env.test.ts`: `requireEnv("OTP_PEPPER")` throws an `EnvError` matching `/OTP_PEPPER/` when the variable is unset.
  - `tests/int/otp.test.ts` (id = phone `+919876543210`, T = `2026-11-17T04:30:00Z`; `otp_challenges` is cleared before each case, so "fresh challenge" means a new issue at T):
    - Issuing at T gives `ok`, with `code` matching `/^\d{6}$/`. The stored document has `attempts: 0`, `expiresAt: T+300_000`, `resendAvailableAt: T+30_000` and `consumedAt: null`. No value in the document equals `code`.
    - Verifying the right code gives `ok`. Verifying it again gives `{ ok: false }` (single use).
    - Five wrong codes, then the right one, give `{ ok: false }`, and `attempts` stays 5.
    - On a fresh challenge, verifying at T + 299_999 gives `ok`. On another fresh challenge, verifying at T + 300_000 gives `{ ok: false, reason: "no_active_challenge" }` while the document still exists.
    - Cooldown: issuing again at T + 29_999 gives `{ ok: false, reason: "cooldown", retryAfterSec: 1 }`. At T + 30_000 it gives `ok`, and the first code no longer verifies.
    - Two parallel `issueOtpChallenge` calls at T give exactly one `ok`.
    - Five parallel `verifyOtpChallenge` calls with the right code give exactly one `ok`.
    - `resendCooldownSec` → 20 at T + 10_000, 0 at T + 30_000, and 0 for an unknown identifier.
    - `cancelOtpChallenge(id, challengeId)` removes the document, and the cooldown becomes 0.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/auth src/server/env.test.ts && pnpm exec vitest run --project int tests/int/otp.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The issue and verify algorithms:

```ts
// issue: the filter only matches a challenge whose cooldown is over; if a live one exists the
// upsert's insert collides on _id (E11000) → { ok: false, reason: "cooldown",
// retryAfterSec: Math.max(1, await resendCooldownSec(id, now)) }. Two racing issues: one wins.
await col.updateOne(
  { _id: identifierKey(id), resendAvailableAt: { $lte: now } },
  { $set: { challengeId, codeHash, attempts: 0, createdAt: now, consumedAt: null,
            expiresAt: plus(now, OTP_TTL_MS), resendAvailableAt: plus(now, OTP_RESEND_COOLDOWN_MS) } },
  { upsert: true },
);

// verify: 1) spend an attempt atomically; null = missing, expired, used or locked
const doc = await col.findOneAndUpdate(
  { _id: identifierKey(id), consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
  { $inc: { attempts: 1 } },
  { returnDocument: "after" },
);
// 2) timingSafeEqual(hex(doc.codeHash), hex(hashOtp({ challengeId: doc.challengeId, identifier: id, code }))) else "mismatch"
// 3) single use: only one racer flips consumedAt
const used = await col.updateOne(
  { _id: doc._id, challengeId: doc.challengeId, consumedAt: null }, { $set: { consumedAt: now } });
// used.modifiedCount === 1 ? { ok: true } : { ok: false, reason: "consumed_concurrently" }
```
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full gate.
- [ ] **Step 5: Commit** `feat(auth): add hashed single-use OTP challenges with attempts and resend cooldown`.

### Task 6: Users and sessions store (PR `feat/auth-sessions`, spec A4 part 1)

**Files:**
- Create: `src/server/auth/users.ts`, `src/server/auth/sessions.ts`.
- Modify: `src/server/db/register-all.ts`.
- Test: `tests/int/users.test.ts`, `tests/int/sessions.test.ts`.

**Interfaces:**
- Consumes: from Task 5, `Identifier`. From Phase F, `getDb()` and `registerIndexes()`.
- Produces:
  - Users:
    - `USERS_COLLECTION = "users"`, with indexes `{ phone: 1 }` named `phone_unique` and `{ email: 1 }` named `email_unique`. Both are unique, with `partialFilterExpression: { <field>: { $type: "string" } }`.
    - `type Role = "customer" | "pharmacist" | "operations" | "admin"`; `STAFF_ROLES = ["pharmacist","operations","admin"] as const`; `type StaffRole`.
    - `type UserDoc = { _id: ObjectId; phone?: string; email?: string; phoneVerifiedAt?: Date; emailVerifiedAt?: Date; role: Role; createdAt: Date; updatedAt: Date; lastLoginAt: Date }`.
    - `type PublicUser = { id: string; phone: string | null; email: string | null; role: Role }`; `toPublicUser(u: UserDoc): PublicUser`.
    - `findOrCreateUserByIdentifier(id: Identifier, now: Date): Promise<{ user: UserDoc; created: boolean }>`. It is one `findOneAndUpdate` upsert with `includeResultMetadata: true`:
      - `$setOnInsert: { role: "customer", createdAt }` (the query supplies `phone` or `email`);
      - `$min: { <channel>VerifiedAt: now }`;
      - `$set: { lastLoginAt, updatedAt }`;
      - retry once on E11000.
    - `getUserById(id: ObjectId): Promise<UserDoc | null>`.
  - Sessions:
    - `SESSIONS_COLLECTION = "sessions"`, with the index `{ expiresAt: 1 }` named `expiresAt_ttl` (`expireAfterSeconds: 0`).
    - `type SessionKind = "customer" | "staff"`; `sessionKindForRole(role: Role): SessionKind`.
    - `SESSION_POLICY = { customer: { idleMs: 2_592_000_000, absoluteMs: null }, staff: { idleMs: 1_800_000, absoluteMs: 43_200_000 } } as const`; `SESSION_TOUCH_INTERVAL_MS = 60_000`.
    - `type SessionDoc = { _id: string /* sha256(token) hex */; userId: ObjectId; kind: SessionKind; createdAt: Date; lastSeenAt: Date; idleExpiresAt: Date; absoluteExpiresAt: Date | null; expiresAt: Date }`.
    - `hashSessionToken(token: string): string`.
    - `createSession(user: Pick<UserDoc, "_id" | "role">, now: Date): Promise<{ token: string; session: SessionDoc }>`, where `token = randomBytes(32).toString("base64url")` (43 characters).
    - `resolveSession(token: string, now: Date): Promise<{ session: SessionDoc; refreshed: boolean } | null>`.
    - `revokeSession(token: string): Promise<void>`.
  - The session rule (the implementer writes it from this):
    - valid ⇔ `now < idleExpiresAt && (absoluteExpiresAt === null || now < absoluteExpiresAt)`.
    - An invalid session → `deleteOne` and return `null`.
    - When the session is valid and `now − lastSeenAt ≥ 60_000`, touch it: `lastSeenAt = now` and `idleExpiresAt = now + idleMs`. Then `refreshed` is `true`.
    - `expiresAt = min(idleExpiresAt, absoluteExpiresAt ?? idleExpiresAt)` on every write.

- [ ] **Step 1: Write the failing tests** (T = `2026-11-17T04:30:00Z`; call `ensureIndexes` in `beforeAll`):
  - `users.test.ts`:
    - A phone at T → `created: true`, `role: "customer"`, `phoneVerifiedAt: T`. Again at T + 1 h → `created: false`, the same `_id`, `phoneVerifiedAt` still T, `lastLoginAt` T + 1 h.
    - The email channel behaves the same way.
    - Ten parallel calls for a new email → `users.countDocuments({ email })` is 1, and all ten return the same `_id`.
    - `toPublicUser` of a phone user → `{ id, phone: "+919876543210", email: null, role: "customer" }`.
  - `sessions.test.ts`:
    - The token matches `/^[A-Za-z0-9_-]{43}$/`. The stored `_id` equals `hashSessionToken(token)`, and no stored value equals the token.
    - `sessionKindForRole`: customer → `customer`; pharmacist, operations and admin → `staff`.
    - Touch throttle: resolving at T + 30 s gives `refreshed: false`, and the stored `lastSeenAt` stays T. At T + 60 s it gives `refreshed: true`.
    - Customer, sliding: resolving at T + 29 d works, and so does T + 58 d. A session left untouched gives `null` at exactly T + 30 d, even though `findOne` saw the document just before. The document is deleted afterwards.
    - Staff, idle: resolving at T + 29 m and at T + 58 m works; at exactly T + 88 m it gives `null`.
    - Staff, absolute: resolving every 25 min from T + 25 m to T + 700 m always works. At exactly T + 720 m it gives `null`.
    - `revokeSession(token)`, then resolving, gives `null`. Revoking an unknown token does not throw. `resolveSession("garbage", T)` gives `null`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/users.test.ts tests/int/sessions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules and register them in `register-all.ts`.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full gate.
- [ ] **Step 5: Commit** `feat(auth): add user find-or-create and DB-backed customer and staff sessions`.

### Task 7: OTP send endpoint and HTTP plumbing (PR `feat/auth-otp-send`, spec A3 part 1)

**Files:**
- Create:
  - `src/server/http.ts`, `src/server/security/origin.ts`, `src/server/auth/login.ts` (`sendOtp`), `src/app/api/auth/otp/send/route.ts`;
  - `tests/helpers/http.ts`, `tests/helpers/clock.ts`, `tests/helpers/otp.ts`.
- Modify: `tests/helpers/mongo.ts` (add `clearCollections`).
- Test: `src/server/http.test.ts`, `src/server/security/origin.test.ts`, `tests/int/auth-otp-send.test.ts`.

**Interfaces:**
- Consumes:
  - from Task 4: `hitRateLimit`, `clientIp` and `ipBucket`;
  - from Task 5: `normalizeIdentifier`, `resendCooldownSec`, `issueOtpChallenge`, `cancelOtpChallenge` and `OTP_TTL_MS`;
  - from Phase F: `getDeps()` (sms, email, now), `getEnv()`, `EnvError` and `readOutbox()`.
- Produces:
  - `class HttpError extends Error { constructor(readonly status: number, readonly code: string, readonly retryAfterSec?: number) }`.
  - `jsonResponse(body: unknown, init?: { status?: number; headers?: HeadersInit }): Response`: always sets `Cache-Control: no-store`.
  - `readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T>`: 415 `unsupported_media_type` unless the content type starts with `application/json`; 400 `invalid_json`; 400 `invalid_request`.
  - `withErrors(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response>`. It maps errors to JSON responses:
    - an `HttpError` → `{ error: code, retryAfterSec? }`, plus a `Retry-After` header when `retryAfterSec` is set;
    - an `EnvError` → 500 `server_misconfigured`;
    - anything else → 500 `internal_error`, logging `err.name` only.
  - `assertSameOrigin(req: Request): void`: for methods other than GET, HEAD and OPTIONS, `Origin` must equal `new URL(req.url).origin` or the origin of `APP_URL`; otherwise it throws `HttpError(403, "bad_origin")`.
  - `OTP_SEND_LIMITS = { perIp: { limit: 20, windowMs: 3_600_000 }, perIdentifier: { limit: 3, windowMs: 600_000 } } as const`. The limiter keys are `` `otp-send:ip:${bucket}` `` and `` `otp-send:id:${identifierKey}` ``.
  - `type SendOtpResult = { ok: true; resendAfterSec: 30 } | { ok: false; error: "invalid_identifier" } | { ok: false; error: "resend_cooldown" | "rate_limited"; retryAfterSec: number } | { ok: false; error: "delivery_failed" }`.
  - `sendOtp(i: { channel: Channel; identifier: string; ipBucket: string; now: Date }): Promise<SendOtpResult>`. The order is fixed:
    1. normalise;
    2. check the cooldown (no limiter is touched);
    3. hit the per-IP limit;
    4. hit the per-identifier limit;
    5. issue;
    6. deliver. If delivery throws, call `cancelOtpChallenge` and return `delivery_failed`.

    Delivery is:
    - phone: `sms.send({ to, templateId: "otp", vars: { code, minutes: "5" } })`;
    - email: `email.send({ to, subject: "Your Aarvion login code", text, html })`, with the copy from "Decisions taken".
  - `POST /api/auth/otp/send` takes the body `SendOtpBody = z.object({ channel: z.enum(["phone","email"]), identifier: z.string().min(1).max(254) })`, defined in `login.ts`. It returns:
    - 200 `{ ok: true, resendAfterSec: 30 }`;
    - 400 `invalid_identifier` or `invalid_request`;
    - 403 `bad_origin`; 415;
    - 429 `resend_cooldown` or `rate_limited`, with `retryAfterSec`;
    - 503 `delivery_failed`.
  - Test helpers:
    - `TEST_ORIGIN = "http://localhost:3000"`;
    - `jsonPost(path, body, opts?: { origin?: string | null; ip?: string; cookie?: string; contentType?: string }): Request`, defaulting to the origin `TEST_ORIGIN`, `x-real-ip: 203.0.113.10` and JSON;
    - `getReq(path, opts?: { cookie?: string }): Request`;
    - `installClock(startIso: string): { now(): Date; advance(ms: number): void }`, implemented with `setDepsForTests`;
    - `lastOtpCode(to: string): Promise<string>`: for SMS, `payload.vars.code`; for email, the first `\b\d{6}\b` in `payload.text`;
    - `clearCollections(...names: string[]): Promise<void>`.

- [ ] **Step 1: Write the failing tests**
  - `origin.test.ts`:
    - A POST to `http://localhost:3000/api/x` with `Origin: http://localhost:3000` passes.
    - `Origin: https://evil.example`, no `Origin`, and `Origin: null` each throw `HttpError` with status 403 and code `"bad_origin"`.
    - A GET without `Origin` passes.
    - With `APP_URL=https://aarvion.example`, `Origin: https://aarvion.example` passes for `http://internal:3000/api/x`.
  - `http.test.ts`:
    - `readJson` with `text/plain` gives 415; with a body `{` gives 400 `invalid_json`; with a schema mismatch gives 400 `invalid_request`.
    - `withErrors` turns `HttpError(429, "rate_limited", 7)` into 429 `{ error: "rate_limited", retryAfterSec: 7 }` with `Retry-After: 7` and `cache-control: no-store`.
    - `new Error("secret detail")` gives 500 `{ error: "internal_error" }`, and the body does not contain `secret detail`. An `EnvError` gives 500 `server_misconfigured`.
  - `tests/int/auth-otp-send.test.ts` (clock at `2026-11-17T04:30:00Z`; `OTP_PEPPER` stubbed; `clearCollections` before each test):
    - Phone: 200 `{ ok: true, resendAfterSec: 30 }`. `readOutbox("+919876543210")` has 1 message with `templateId: "otp"`, `vars.code` matching `/^\d{6}$/` and `vars.minutes: "5"`.
    - Email: `subject` is `"Your Aarvion login code"`, and `text` contains the code and `"5 minutes"`.
    - Insert a user with phone `+919876543210`. Sends to it and to `+919812345678` both give 200 with deep-equal bodies (same response whether or not the account exists).
    - `"+1 2025550123"`, `"5876543210"` and email `"not-an-email"` each give 400 `invalid_identifier`, with no outbox message and `rate_limits.countDocuments()` of 0.
    - `Origin: https://evil.example` gives 403, with nothing sent.
    - A second send at +10 s gives 429 `{ error: "resend_cooldown", retryAfterSec: 20 }` with `Retry-After: 20`. The identifier counter is still 1.
    - Per identifier: sends at +0, +31 s and +62 s give 200; +93 s gives 429 `rate_limited`; +600 s gives 200.
    - Per IP: 20 phones `` `+9198765432${nn}` `` (nn = 00..19) from `203.0.113.9` give 200; the 21st gives 429 `rate_limited`.
    - IPv6: 20 sends to 20 different phones from `2001:db8:1:2::<n>`. A 21st phone from `2001:db8:1:2:ffff::1` gives 429. One from `2001:db8:1:3::1` gives 200.
    - Delivery failure: with `setDepsForTests({ sms: { send: async () => { throw new Error("provider down") } } })`, the send gives 503 `delivery_failed`. After restoring the mock, an immediate resend gives 200.
    - `OTP_PEPPER` unset gives 500 `server_misconfigured`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/http.test.ts src/server/security && pnpm exec vitest run --project int tests/int/auth-otp-send.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The route is just: `export const POST = withErrors(async (req) => { assertSameOrigin(req); const body = await readJson(req, SendOtpBody); … map SendOtpResult → jsonResponse })`. `now` comes from `getDeps().now()`, and `ipBucket` from `ipBucket(clientIp(req))`.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full gate.
- [ ] **Step 5: Commit** in two commits:
  - `feat(http): add JSON error mapping and same-origin check for route handlers`;
  - `feat(auth): add POST /api/auth/otp/send with per-identifier and per-IP limits`.

### Task 8: OTP verify endpoint and session cookie (PR `feat/auth-otp-verify`, spec A3 part 2)

**Files:**
- Create: `src/server/auth/cookie.ts`, `src/app/api/auth/otp/verify/route.ts`.
- Modify: `src/server/auth/login.ts` (add `verifyOtpAndLogin`), `tests/helpers/http.ts` (add `sessionTokenFrom`).
- Test: `src/server/auth/cookie.test.ts`, `tests/int/auth-otp-verify.test.ts`.

**Interfaces:**
- Consumes:
  - from Task 4: `hitRateLimit` and `peekRateLimit`;
  - from Task 5: `normalizeIdentifier`, `identifierKey` and `verifyOtpChallenge`;
  - from Task 6: `findOrCreateUserByIdentifier`, `toPublicUser`, `createSession`, `revokeSession`, `SessionKind`, and in tests `resolveSession` and `hashSessionToken`;
  - from Task 7: `withErrors`, `readJson`, `jsonResponse`, `assertSameOrigin` and the helpers.
- Produces:
  - `SESSION_COOKIE = "__Host-aarv_sid"`.
  - `readSessionToken(req: Request): string | null`: parses the `Cookie` header and returns `null` unless the value matches `/^[A-Za-z0-9_-]{43}$/`.
  - `sessionCookieHeader(token: string, kind: SessionKind): string` gives exactly:
    - customer: `` `__Host-aarv_sid=${token}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax` ``;
    - staff: the same string without `Max-Age=2592000; `.
  - `clearSessionCookieHeader(): string` gives `"__Host-aarv_sid=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax"`.
  - `OTP_VERIFY_FAILURE_LIMIT = { limit: 10, windowMs: 86_400_000 } as const`, with the key `` `otp-verify-fail:${identifierKey}` ``.
  - `type VerifyOtpResult = { ok: true; user: PublicUser; isNewUser: boolean; token: string; kind: SessionKind } | { ok: false; error: "invalid_code" } | { ok: false; error: "too_many_attempts"; retryAfterSec: number }`.
  - `verifyOtpAndLogin(i: { channel: Channel; identifier: string; code: string; existingToken: string | null; now: Date }): Promise<VerifyOtpResult>`. The order:
    1. Normalise. A `null` gives `invalid_code`.
    2. Peek the failure cap. If it does not allow, return `too_many_attempts`.
    3. Run `verifyOtpChallenge`. On failure, hit the failure cap and return `invalid_code`.
    4. Find or create the user.
    5. If `existingToken` is present, revoke it.
    6. `createSession`.
  - `POST /api/auth/otp/verify` takes the body `VerifyOtpBody = SendOtpBody.extend({ code: z.string().regex(/^\d{6}$/) })`. It returns:
    - 200 `{ user: PublicUser, isNewUser }` with `Set-Cookie: sessionCookieHeader(token, kind)`;
    - 400 `invalid_code` (every failure reason, including an identifier that never requested a code);
    - 403; 429 `too_many_attempts`.
  - `sessionTokenFrom(res: Response): string | null` (test helper).

- [ ] **Step 1: Write the failing tests**
  - `cookie.test.ts`:
    - Both header strings above, exactly.
    - `readSessionToken`: `Cookie: a=1; __Host-aarv_sid=<43 valid chars>` returns the token. A 42-character value, a value containing `.`, no cookie, or `aarv_sid=<valid>` (no prefix) returns `null`.
  - `tests/int/auth-otp-verify.test.ts` (clock, pepper and clearing as in Task 7; send first, then read the code with `lastOtpCode`):
    - The right code gives 200 `{ user: { id, phone: "+919876543210", email: null, role: "customer" }, isNewUser: true }`. `Set-Cookie` matches `/^__Host-aarv_sid=[A-Za-z0-9_-]{43}; Path=\/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax$/`. Users count 1; sessions count 1.
    - A second login (resend after 31 s) gives `isNewUser: false` and the same `id`.
    - A wrong code gives 400 `{ error: "invalid_code" }`. A verify for `+919812345678`, which never requested a code, gives the identical status and body.
    - At +300 s, the code gives 400. The same code verified twice gives 200, then 400.
    - **Review Focus 1, races:** `Promise.all` of two verify POSTs with the right code gives statuses `[200, 400]` once sorted, and sessions count 1.
    - **Review Focus 2, brute force across challenges:**
      1. Challenge 1: five wrong codes, each 400.
      2. Send at +31 s; challenge 2: five wrong codes, each 400.
      3. Send at +62 s; the right code gives 429 `too_many_attempts` with `retryAfterSec > 0`.
      4. At +24 h: send, then the right code gives 200.
    - **Review Focus 4, fixation:**
      - `createSession` for another user gives `oldToken`. A verify carrying `cookie: __Host-aarv_sid=<oldToken>` gives 200. `sessionTokenFrom(res) !== oldToken` and `resolveSession(oldToken, now)` is `null`.
      - A cookie with a never-stored, attacker-chosen token gives a different new token, and `sessions.findOne({ _id: hashSessionToken(chosen) })` is `null`.
    - Insert a user with `role: "pharmacist"`. Their verify `Set-Cookie` has no `Max-Age`.
    - A bad `Origin` gives 403, and the challenge's `attempts` is unchanged.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/auth/cookie.test.ts && pnpm exec vitest run --project int tests/int/auth-otp-verify.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `cookie.ts`, `verifyOtpAndLogin` and the route. The route reads `existingToken` with `readSessionToken(req)` and sets the cookie on the `jsonResponse` headers.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full gate.
- [ ] **Step 5: Commit** `feat(auth): add POST /api/auth/otp/verify with find-or-create user and session cookie`.

### Task 9: Guards, me, logout and audit log (PR `feat/auth-guards-audit`, spec A4 part 2)

**Files:**
- Create: `src/server/auth/guards.ts`, `src/server/audit.ts`, `src/app/api/auth/me/route.ts`, `src/app/api/auth/logout/route.ts`.
- Modify: `src/server/auth/login.ts` (audit on login), `src/server/db/register-all.ts`.
- Test: `src/server/audit.test.ts` (static), `tests/int/audit.test.ts`, `tests/int/auth-session-routes.test.ts`.

**Interfaces:**
- Consumes:
  - from Task 6: `resolveSession`, `revokeSession`, `getUserById`, `toPublicUser`, `UserDoc`, `SessionDoc`, `StaffRole` and `Role`;
  - from Task 7: `HttpError`, `withErrors`, `jsonResponse` and `assertSameOrigin`;
  - from Task 8: `readSessionToken`, `sessionCookieHeader` and `clearSessionCookieHeader`.
- Produces:
  - `type AuthContext = { user: UserDoc; session: SessionDoc; token: string; refreshed: boolean }`.
  - `getAuth(req: Request, now: Date): Promise<AuthContext | null>`.
  - `requireUser(req: Request): Promise<AuthContext>`: throws `HttpError(401, "unauthenticated")`.
  - `requireRole(req: Request, roles: readonly StaffRole[]): Promise<AuthContext>`: throws 401 when unauthenticated, and `HttpError(403, "forbidden")` when `user.role ∉ roles` **or** `session.kind !== "staff"`.
  - `type AuditAction = "auth.login" | "auth.logout"`.
  - `type AuditEntry = { at: Date; action: AuditAction; actor: { type: "user"; userId: ObjectId; role: Role } | { type: "system" }; target?: { type: string; id: string }; meta?: Record<string, string | number | boolean | null> }`.
  - `appendAudit(entry: AuditEntry): Promise<void>`: an `insertOne` into `audit_logs`, which is the module's only runtime export. Indexes: `{ at: -1 }` named `at_desc`; `{ "actor.userId": 1, at: -1 }` named `actorUserId_at_desc`.
  - `verifyOtpAndLogin` appends `{ action: "auth.login", actor: { type: "user", userId, role }, meta: { channel, isNewUser } }` after `createSession`.
  - `GET /api/auth/me`:
    - 200 `{ user: PublicUser }`, plus `Set-Cookie: sessionCookieHeader(token, "customer")` when `refreshed && kind === "customer"`;
    - 401 `{ error: "unauthenticated" }`.
  - `POST /api/auth/logout`: checks the Origin, appends `auth.logout` when a session resolves, revokes it, and returns 204 with `Set-Cookie: clearSessionCookieHeader()` and `Cache-Control: no-store`. It is idempotent.

- [ ] **Step 1: Write the failing tests**
  - `src/server/audit.test.ts`:
    - `Object.keys(await import("./audit"))` equals `["appendAudit"]`.
    - No non-test file under `src/` other than `src/server/audit.ts` contains the string `audit_logs` (`fs.globSync`, excluding `**/*.test.ts`).
  - `tests/int/audit.test.ts`:
    - After a verify (via the Task 8 routes), `audit_logs` has 1 document matching `{ action: "auth.login", actor: { type: "user", role: "customer" }, meta: { channel: "phone", isNewUser: true } }` with `at` equal to the clock.
    - Indexes `at_desc` and `actorUserId_at_desc` exist.
  - `tests/int/auth-session-routes.test.ts` (log in through the routes, or call `createSession` directly for staff):
    - `/me` without a cookie gives 401 `unauthenticated` with `cache-control: no-store`. With a cookie it gives 200 `{ user: { id, phone: "+919876543210", email: null, role: "customer" } }`.
    - `/me` at +30 s has no `Set-Cookie`. At +2 min it re-issues `Max-Age=2592000`.
    - A pharmacist session: `/me` at +29 min gives 200; then, 31 min after that, 401.
    - Logout without `Origin` gives 403. With `Origin`, it gives 204 and a `Set-Cookie` containing `Max-Age=0`. Afterwards, `/me` with the old token gives 401, and a second logout gives 204. `audit_logs` has `auth.logout`.
    - `requireRole(req, ["pharmacist","admin"])`:
      - a pharmacist staff session passes;
      - an operations staff session throws 403;
      - **Review Focus 4, stale privilege:** for a customer session whose user is then set to `role: "admin"`, it throws 403; after logging in again (a new staff-kind session) it passes.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/audit.test.ts && pnpm exec vitest run --project int tests/int/audit.test.ts tests/int/auth-session-routes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the modules, the routes (`/me` exports `dynamic = "force-dynamic"`) and the `login.ts` audit call. Register `audit.ts` in `register-all.ts`.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full gate.
- [ ] **Step 5: Commit** in two commits:
  - `feat(audit): add append-only audit log writer`;
  - `feat(auth): add requireUser and requireRole guards, /api/auth/me and /api/auth/logout`.

### Task 10: Preview isolation, dev outbox and the auth e2e (PR `feat/dev-outbox-auth-e2e`, spec A4 part 3 and carried rulings)

**Files:**
- Create: `src/server/dev-only.ts`, `src/app/dev/outbox/route.ts`, `e2e/auth.spec.ts`.
- Modify:
  - `src/server/providers/guard.ts`;
  - `playwright.config.ts`, `.github/workflows/ci.yml` (`e2e` job), `e2e/smoke.spec.ts` (health `db: "ok"`);
  - `docs/decisions/environments.md`: change "Enforcement status" to enforced, and state that production sets `MONGODB_DB=aarvion_prod`;
  - `.env.example`: comment on `MONGODB_DB`;
  - `README.md`: e2e needs `pnpm db:up`.
- Test: `src/server/providers/guard.test.ts`, `src/server/dev-routes.test.ts`, `tests/int/dev-outbox.test.ts`, `e2e/auth.spec.ts`.

**Interfaces:**
- Consumes: from Phase F, `getEnv()`, `readOutbox()` and `getDeps()`. From Tasks 7 to 9, the auth routes and helpers.
- Produces:
  - `PRODUCTION_DB_NAME = "aarvion_prod"`.
  - `targetsProductionDb(env: Pick<Env, "MONGODB_URI" | "MONGODB_DB">): boolean`: compares, ignoring case, `MONGODB_DB` and the URI path database (`/^mongodb(?:\+srv)?:\/\/[^/]*\/([^?]*)/`, decoded).
  - `isMockForbidden(): boolean`: the existing two conditions `|| targetsProductionDb(getEnv())`.
  - `requireDevRoute(): void`: when `isMockForbidden()` is true, it calls `notFound()` from `next/navigation`. In route handlers, Next 16 turns the thrown digest `NEXT_HTTP_ERROR_FALLBACK;404` into a 404.
  - `GET /dev/outbox?to=<recipient>`:
    - 200 `{ messages: { channel, to, createdAt, payload }[] }`, oldest first, with `no-store`;
    - 400 `{ error: "missing_to" }`;
    - 404 when the guard refuses;
    - exports `dynamic = "force-dynamic"`.
  - Playwright `webServer.env`:
    - `MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true"`;
    - `MONGODB_DB: "aarvion_e2e"`;
    - `OTP_PEPPER: randomBytes(32).toString("hex")`;
    - `ALLOW_MOCKS_IN_PROD_BUILD: "1"`.
  - CI `e2e` job: add job-level env `MONGODB_URI` (as above) and `MONGODB_DB: aarvion_e2e`, then these steps before `pnpm test:e2e`, and the upload after it:

```yaml
      - run: pnpm db:up
      - run: pnpm db:indexes
      # existing: pnpm test:e2e with CI: "true"
      - if: ${{ failure() }}
        uses: actions/upload-artifact@v7
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 7
```

- [ ] **Step 1: Write the failing tests**
  - `guard.test.ts` (set the environment as in `deps.test.ts`):
    - `MONGODB_DB=aarvion_prod` → `true`; `MONGODB_DB=Aarvion_Prod` → `true`.
    - `MONGODB_URI=mongodb+srv://u:p@cluster0.example.mongodb.net/aarvion_prod?retryWrites=true` with `MONGODB_DB=aarvion_preview` → `true`. So does `mongodb://h1:27017,h2:27017/aarvion_prod?replicaSet=rs0`.
    - `NODE_ENV=production`, `ALLOW_MOCKS_IN_PROD_BUILD=1`, `MONGODB_DB=aarvion_preview` → `false`. The same with `MONGODB_DB=aarvion_prod` → `true`.
    - `getDeps()` with `MONGODB_DB=aarvion_prod` throws `/mock providers are not allowed in production/i`.
  - `dev-routes.test.ts`: at least one `route.ts` or `page.tsx` exists under `src/app/dev/`, and each contains `requireDevRoute()`.
  - `tests/int/dev-outbox.test.ts`:
    - After `getDeps().sms.send({ to: "+919876543210", templateId: "otp", vars: { code: "123456" } })`, `GET /dev/outbox?to=%2B919876543210` gives 200, with 1 message whose `payload.vars.code` is `"123456"`.
    - Without `to`, it gives 400 `missing_to`.
    - With `VERCEL_ENV=production` (after `resetEnvForTests`), `GET` rejects with `{ digest: "NEXT_HTTP_ERROR_FALLBACK;404" }`, and so it does with `MONGODB_DB=aarvion_prod`.
  - `e2e/auth.spec.ts` (Chromium):
    1. Go to `/`.
    2. Inside the page, `fetch` `POST /api/auth/otp/send` for a unique `` `e2e-${Date.now()}@example.test` ``, with a random `x-real-ip: 198.51.100.<1..254>`. It gives `{ status: 200, body: { ok: true, resendAfterSec: 30 } }`.
    3. Read the code from `request.get("/dev/outbox?to=…")`: the first `\d{6}` in the last message's `payload.text`.
    4. Verify; it gives 200 with `user.email`.
    5. `context.cookies()` contains `__Host-aarv_sid` with `{ httpOnly: true, secure: true, sameSite: "Lax", path: "/" }`.
    6. `GET /api/auth/me` gives 200.
    7. `POST /api/auth/logout` gives 204; then `/me` gives 401.

    If Chromium rejects the `__Host-` cookie on `http://localhost`, stop and report. Do not weaken the cookie.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/providers src/server/dev-routes.test.ts && pnpm exec vitest run --project int tests/int/dev-outbox.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the guard, `dev-only.ts` and the route. Update the Playwright config, CI, smoke test and docs.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS). Then run `pnpm db:up && MONGODB_DB=aarvion_e2e pnpm db:indexes && pnpm test:e2e` (expected: smoke and auth pass), then the full gate.
- [ ] **Step 5: Verify** the production refusal by hand:
  1. Run `pnpm build && VERCEL_ENV=production MONGODB_URI=mongodb://localhost:27017/?directConnection=true PORT=3200 pnpm start`.
  2. Run `curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3200/dev/outbox?to=x'`. Expected: `404`. Paste the output in the PR body.
- [ ] **Step 6: Commit** in three commits:
  - `feat(security): refuse mock providers when the database is production`;
  - `feat(dev): add guarded /dev/outbox route`;
  - `test(e2e): add OTP login e2e with Mongo in CI and report upload on failure`.

  PR title: `feat(security): enforce preview isolation, add dev outbox and auth e2e`.

### Task 11: Order state machine (PR `feat/order-state-machine`, spec O1 part 1)

**Files:**
- Create: `src/server/prescriptions/validity.ts`, `src/server/orders/status.ts`.
- Test: `src/server/prescriptions/validity.test.ts`, `src/server/orders/status.test.ts`.

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `RX_VALIDITY_MONTHS = 6`.
  - `addCalendarMonthsIst(date: Date, months: number): Date`: works on the Asia/Kolkata (UTC+05:30, no DST) wall clock, clamps the day to the target month's last day, and returns an instant.
  - `type RxSnapshot = { status: "pending" | "approved" | "rejected"; rxDate: Date | null; validUntil: Date | null }`. `rxDate` is midnight IST of the Rx's date; `validUntil` is an exclusive instant.
  - `isRxValidOn(rx: RxSnapshot, on: Date): boolean` ⇔ `status === "approved" && rxDate !== null && rxDate <= on && on < min(validUntil ?? ∞, addCalendarMonthsIst(rxDate, 6))`.
  - `ORDER_STATUSES = ["pending_payment","placed","confirmed","packed","shipped","delivered","on_hold","cancelled"] as const`; `type OrderStatus`.
  - `type PaymentMethod = "cod" | "prepaid"`; `type PaymentStatus = "pending" | "paid" | "refund_pending" | "refunded"`; `type Actor = "customer" | "staff" | "system"`.
  - `type OrderForTransition = { status: OrderStatus; createdAt: Date /* the order date */; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; rx: RxSnapshot }`.
  - `type OrderEvent = { type: "payment_captured" } | { type: "confirm" } | { type: "hold"; reason: string } | { type: "pack" } | { type: "ship"; awb: string; courier: string; trackingUrl?: string } | { type: "deliver" } | { type: "cancel"; reason: string }`.
  - `type TransitionErrorCode = "invalid_transition" | "rx_not_valid" | "payment_required" | "awb_required" | "reason_required"`.
  - `type StatusHistoryEntry = { from: OrderStatus; to: OrderStatus; at: Date; by: Actor; reason?: string }`.
  - `type TransitionResult = { ok: true; to: OrderStatus; entry: StatusHistoryEntry; effects: "refund"[] } | { ok: false; error: TransitionErrorCode }`.
  - `initialStatus(method: PaymentMethod): OrderStatus`: prepaid → `pending_payment`, cod → `placed`.
  - `transition(order: Readonly<OrderForTransition>, event: OrderEvent, ctx: { at: Date; by: Actor }): TransitionResult`. It is pure and never mutates `order`.
  - `ORDER_EDGES: Readonly<Record<OrderStatus, readonly OrderStatus[]>>` holds exactly these values, which come from the spec:

```ts
{ pending_payment: ["placed", "cancelled"],         // payment_captured | cancel
  placed:          ["confirmed", "on_hold", "cancelled"],
  on_hold:         ["confirmed", "cancelled"],      // new Rx approved | cancel
  confirmed:       ["packed", "cancelled"],         // cancel allowed until packed
  packed:          ["shipped"],
  shipped:         ["delivered"],
  delivered: [], cancelled: [] }
```
  - Guards:
    - `confirm` and `ship` both need `isRxValidOn(order.rx, order.createdAt)`, otherwise `rx_not_valid`. They also need `paymentMethod === "cod" || paymentStatus === "paid"`, otherwise `payment_required`.
    - `ship` also needs `awb.trim()` and `courier.trim()` to be non-empty, otherwise `awb_required`.
    - `hold` and `cancel` need `reason.trim()` of length 1 to 500, otherwise `reason_required`.
  - Effects: `hold` or `cancel` while `paymentStatus === "paid"` gives `["refund"]`; otherwise `[]`.

- [ ] **Step 1: Write the failing tests**
  - `validity.test.ts`:
    - `addCalendarMonthsIst(2026-05-16T18:30:00Z, 6)` → `2026-11-16T18:30:00Z`.
    - `(2026-08-30T18:30:00Z, 6)` → `2027-02-27T18:30:00Z` (31 Aug clamps to 28 Feb). `(2027-08-30T18:30:00Z, 6)` → `2028-02-28T18:30:00Z` (29 Feb, a leap year).
    - For an approved Rx with `rxDate` 2026-05-16T18:30:00Z and `validUntil: null`: `isRxValidOn` is true at `2026-11-16T18:29:59.999Z` and false at `2026-11-16T18:30:00Z`.
    - With `validUntil` 2026-08-16T18:30:00Z: true at `…18:29:59.999Z`, false at `18:30:00Z`.
    - With `validUntil` 2027-05-16T18:30:00Z (beyond the cap): false at `2026-11-16T18:30:00Z`.
    - False when `rxDate` is after `on`, when the status is `pending` or `rejected`, or when `rxDate` is null.
  - `status.test.ts`:
    - `happy(status)` = `{ status, createdAt: 2026-11-16T06:00:00Z, paymentMethod: "prepaid", paymentStatus: "paid", rx: { status: "approved", rxDate: 2026-11-01T18:30:00Z, validUntil: null } }`.
    - `EVENT_FOR` maps:
      - `placed` → `payment_captured`, `confirmed` → `confirm`, `on_hold` → `hold` with reason `"Rx unreadable"`, `packed` → `pack`;
      - `shipped` → `ship` with `{ awb: "AWB123", courier: "Delhivery" }`, `delivered` → `deliver`;
      - `cancelled` → `cancel` with reason `"Ordered by mistake"`;
      - `pending_payment` → no event.
    - `ORDER_EDGES` deep-equals the table above.
    - **All 64 pairs:** `it.each` over 8 × 8 `(from, to)`. When `to` has an event, `transition(happy(from), EVENT_FOR[to], ctx).ok` equals `ORDER_EDGES[from].includes(to)`, and an ok result has `to` equal to the target. Rows targeting `pending_payment` assert that it is in no edge list.
    - `initialStatus("prepaid")` → `"pending_payment"`; `initialStatus("cod")` → `"placed"`.
    - `confirm` from `placed`:
      - Rx pending → `rx_not_valid`.
      - `rxDate` 2026-04-30T18:30:00Z with `createdAt` 2026-11-16 (more than 6 months) → `rx_not_valid`.
      - An Rx valid on `createdAt` 2026-11-10 but expiring 2026-11-12, confirmed with `ctx.at` 2026-11-20 → `ok` (judged on the order date).
      - COD with `paymentStatus: "pending"` → `ok`.
      - `on_hold`, prepaid and `refunded` → `payment_required`.
    - `ship` from `packed`: `awb: ""` or `"  "` → `awb_required`; `courier: ""` → `awb_required`; `rx.status: "rejected"` → `rx_not_valid`.
    - `hold` or `cancel` with reason `""` or `"x".repeat(501)` → `reason_required`.
    - Effects: `hold` on a paid prepaid order → `["refund"]`; `cancel` from `confirmed`, paid → `["refund"]`; `cancel` of a COD order → `[]`; `cancel` from `pending_payment` with `pending` → `[]`.
    - The entry for `cancel` from `placed` with `{ at, by: "customer" }` → `{ from: "placed", to: "cancelled", at, by: "customer", reason: "Ordered by mistake" }`.
    - A deep-frozen input does not throw (no mutation).
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/orders src/server/prescriptions`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules. `transition` checks `ORDER_EDGES` first (`invalid_transition`), then the event's guards.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full gate.
- [ ] **Step 5: Commit** `feat(orders): add pure order state machine with Rx, payment and AWB guards`.

### Task 12: Order number counter (PR `feat/order-number`, spec O1 part 2)

**Files:**
- Create: `src/server/orders/order-number.ts`.
- Test: `src/server/orders/order-number.test.ts`, `tests/int/order-number.test.ts`.

**Interfaces:**
- Consumes: from Phase F, `getDb()`.
- Produces:
  - `COUNTERS_COLLECTION = "counters"`. The document is `{ _id: "order-number:YYMM"; seq: number }`; no extra index is needed.
  - `orderMonthKey(now: Date): string`: `YYMM` of the Asia/Kolkata calendar month.
  - `formatOrderNumber(yymm: string, seq: number): string` → `` `AAR-${yymm}-${String(seq).padStart(5, "0")}` ``. It is never truncated.
  - `nextOrderNumber(now: Date): Promise<string>`: `findOneAndUpdate({ _id }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" })`, retried once on E11000.

- [ ] **Step 1: Write the failing tests**
  - Unit:
    - `orderMonthKey(2026-11-30T18:29:59.999Z)` → `"2611"`; `(2026-11-30T18:30:00Z)` → `"2612"`; `(2026-12-31T18:30:00Z)` → `"2701"`.
    - `formatOrderNumber("2611", 42)` → `"AAR-2611-00042"`; `("2611", 100000)` → `"AAR-2611-100000"`.
  - Int:
    - The first call in a month → `"AAR-2611-00001"`.
    - 50 parallel calls give 50 distinct numbers, whose sequences sort to exactly 1..50.
    - The first call at `2026-11-30T18:30:00Z` → `"AAR-2612-00001"`, while November's counter is unchanged.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/orders/order-number.test.ts && pnpm exec vitest run --project int tests/int/order-number.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full gate.
- [ ] **Step 5: Commit** `feat(orders): add atomic monthly order-number counter AAR-YYMM-NNNNN`.

## After this plan
- **C3–C5** (home, category, product page, search UI) consume `listVisibleCategories`, `listProducts`, `getProductBySlug` and `getFamily`. They add page-level caching with a `catalogue` tag, and C4 adds country of origin.
- **A5** (login UI) consumes the send and verify routes, and adds consent plus the 18+ declaration to verify for new accounts.
- **D1** (admin roles) creates staff users and must revoke the user's sessions when a role changes.
- **K1 and O2** enforce the order caps: 10 per product, 20 packs per order, and COD at most 500000 paise. They persist orders with `initialStatus`, `transition` (conditional on `{ _id, status: from }`) and `nextOrderNumber`.
