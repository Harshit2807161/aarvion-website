# Phase K + R (Server Cart and Prescriptions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the session-only UI cart with a capped server cart (with a guest cart merged at login and a `/cart` page), and let a signed-in customer upload a prescription that is validated, re-encoded, stored privately and listed at `/account/prescriptions`, in 15 tasks of at most 400 changed lines each.

**Architecture:**
- The rules are pure modules in `src/server/cart/rules.ts`, `src/server/catalogue/pricing.ts` (`cartTotals`), `src/server/prescriptions/review.ts` and `file-check.ts`. Mongo repositories and services sit beside them, and thin route handlers under `src/app/api/{cart,prescriptions}/**` check the Origin, parse with zod, call one service and map the result.
- Carts store slugs and quantities only. Every read prices the lines from Mongo (never from the cached catalogue), and each write is a compare-and-set on a `rev` counter. The client `cartStore` keeps its public surface (`subscribe`, `getSnapshot`, `getServerSnapshot`, `dispatch`), so `CartControl` and `CartPill` barely change. Guests write to `sessionStorage`; signed-in users write optimistically to the server.
- A prescription upload has three steps: (1) the server issues a single-use staging slot; (2) the bytes go to that slot, either straight to Vercel Blob (private) through a client token or, in dev and test, through `PUT` to our own handler; (3) a finalise call validates the bytes (magic bytes, sharp re-encode with metadata stripped, PDF scan), stores the final private file and inserts the record. Files are read only through an ownership-checked handler.

**Tech Stack:** Next.js 16.4 route handlers and pages (Cache Components on), React 19.3, TypeScript 6.0 strict, `mongodb` 7.9 + zod 4.6, sharp 0.35, `@vercel/blob` (new; private store, client uploads), Vitest 5 (`unit`, `ui`, `int` with `MongoMemoryReplSet`), Playwright 1.65.

**Spec:**
- `docs/requirements.md`: §5.2 (the guest cart merges at login; login is required to upload or check out), §5.4 Prescriptions, §5.5 Cart and checkout, §6 (audit of every prescription view), §7 business rules, §9 security (prescriptions are private; prices are computed on the server).
- The approved master plan, `docs/plan/project-plan.md` (`/Users/harshi/.claude/plans/pasted-content-id-83b6-leave-them-misty-micali.md`): Stage 5 phase rows **K** ("cart API with guest merge; shared cart store and drawer") and **R** ("file validation (magic bytes, sharp re-encode, PDF checks); private storage and API; upload UI"); the data model (`prescriptions`, `carts`); Security and compliance; Performance.
- Owner decisions: Razorpay + COD with online payment hidden until live keys exist (`SITE_CONFIG.onlinePayments`); price = MRP − ₹20; free delivery; Rx validity 6 months; 8 MB uploads; Indian mobile OTP login; 10 per product and 20 packs per order (requirements defaults accepted, `docs/decisions/rulings.md`).
- Carried rulings: `docs/decisions/rulings.md`, `docs/decisions/phase-ca-ledger.md` ("Carry → K1", "Carry → R phase"), `.superpowers/sdd/2026-11-17-phase-ui/progress.md` (every Ruling and Carry line relevant here is in Global Constraints), and the UI plan's "After this plan" (K1/K2, R3).
- Code at `main` c16c724. Tasks K4 and R7 depend on the header sign-in dialog (`openLogin`, `LOGIN_EVENT`, UI Task 43): part A merged as #171; the account pill follows.

Handoff labels map onto these tasks as follows. The handoff's "K1 cart API with guest merge" is K1–K3; "K2 shared cart store and drawer" is K4–K7; "R3 `/account/prescriptions`" is R7.

## Global Constraints

Carried (repo rules; AGENTS.md wins if it differs):
- Branch `type/short-desc` from up-to-date `origin/main`; Conventional Commits; small atomic commits (refactor, format and behaviour apart); squash merge. **No `Co-Authored-By` trailer and no "Generated with" line.** PR body sections: What / Why / How tested (with the command output) / Risks and rollback.
- **≤ 400 changed lines per PR** (`pnpm pr-size origin/main`), Markdown included. Only `docs/superpowers/**`, `docs/decisions/**`, the lockfile, `data/**`, `public/**`, binaries and `// @generated shadcn` files are excluded. Over the cap, split at the seam the task names onto a fresh branch from `origin/main`. Never trim tests or meaningful docs to fit, and never touch the guard.
- Merge gate: `lint`, `typecheck`, `unit`, `int`, `build`, `e2e`, `pr-title`, `branch-name`, `pr-size`, each `pass` by name. The controller merges; implementers never merge their own PRs. Never merge on local evidence alone. After a background merge, confirm with `gh pr view <n> --json state` before dispatching dependants.
- **Definition of done:** tests written first and the full local check green:
  `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build`, then `pnpm db:up && MONGODB_DB=aarvion_e2e pnpm db:indexes && MONGODB_DB=aarvion_e2e pnpm seed && pnpm test:e2e`. Also:
  - a `CHANGELOG.md` line under `## [Unreleased]` ending with the PR number; resolve conflicts by hand, keeping each line from both sides once (the union driver was reverted, #86);
  - `docs/dev/**` updated, where in `architecture.md` you add or edit only your own file's one-line bullet; collection rows go in its "Collections and indexes" table, and rate-limit keys under it;
  - a ruling recorded in `docs/decisions/rulings.md` for any rule that changes.
- Lockfile conflict: take main's `pnpm-lock.yaml`, re-run `pnpm install` and commit it in a merge commit. Never rebase pushed work.
- Visual checks run on a track's own port (`PORT=33x1 pnpm start`), never 3100. One live agent per worktree.
- **Routes:**
  - mutations call `assertSameOrigin(req)` inside `withErrors`;
  - per-user responses use `jsonResponse` (`no-store`);
  - cookies are read from `req.headers`, never `cookies()`;
  - every GET handler's first statement is `await connection()`, and route files never export `dynamic`, `revalidate` or `fetchCache` (`src/server/route-config.test.ts`);
  - **[carry K1]** every customer route that calls `requireUser` re-issues the sliding cookie when the session slid (`sessionRefreshHeaders`, Task K2).
- **Time:** `src/server/**` never calls `new Date()` or `Date.now()`; functions take `now: Date`, and routes read `getDeps().now()` once per request.
- **Atomicity:** writes that can race are single-document atomic operations: `$inc`, a conditional update on `{ _id, rev }` or `{ _id, status: from }`, `findOneAndDelete` for single use, or an upsert with one E11000 retry. Never an unconditional read-then-write.
- **Indexes:** each has an explicit `name`; a module that registers indexes is imported by `src/server/db/register-all.ts`; never change an index in place. **[carry]** A lookup that is meant to hit a partial index carries the partial filter's `$type` (`{ $eq: v, $type: "string" }`).
- **Inputs** reach Mongo only as zod-parsed primitives. No user input becomes a regex, an operator object or a field name: cart lines are an array of `{ slug, qty }`, never a slug-keyed object in Mongo.
- **Logs and messages:** error names only. Never log or return a patient name, file bytes, a file name, a rejection note, a phone number, an email, a code or a token. Audit rows hold ids and flags only. No prescription content ever goes into an SMS, an email or a toast.
- **Client imports:** `src/components/**` and the client-safe `src/lib/**` import at runtime from `src/server/**` only `catalogue/pricing`, `catalogue/search`, `catalogue/order` and, from Task K1, `cart/rules`; anything else is a statement-level `import type` (`src/components/server-imports.test.ts`).
- **Prices:**
  - computed only by `sellingPricePaise()` and, from K1, `cartTotals()` in `pricing.ts`; never stored in a cart;
  - UI code never reads `pricePaise` or `MRP_DISCOUNT_PAISE` and never writes `- 2000` (`src/lib/price-source.test.ts`); amounts render through `StampPrice`, `PriceInline` or `Rupees`;
  - **[carry K/O]** cart reads reprice from Mongo, never from `getCachedProducts()`;
  - no headline or title leads with the ₹20.
- **Copy:**
  - no invented claims; page and section tests run `findClaims` (`tests/helpers/claims.ts`) on their rendered text;
  - Rx-universal copy is gated on data [C25];
  - online-payment and refund copy is gated on `SITE_CONFIG.onlinePayments` (false today: "cash on delivery" wording only; prepaid-refund wording is conditional or omitted);
  - the ₹5,000 COD cap is copy, not config, until O;
  - new customer strings sit in one copy module per feature, marked "awaiting owner approval" when not from the prototype.
- **Accessibility:**
  - one polite live region: speak through `announce()`; never add `aria-live` or an `<output>` (it is an implicit live region), so counts are a `<span>`;
  - a submit that invalidates two or more fields shows one focused `ErrorSummary`, with `errorAlert={false}` on those fields; one invalid field keeps its own alert [carry];
  - targets ≥ 44 px; input text 16 px;
  - pass `returnFocusTo` to an `Overlay` that a click opened.
- **CSS:**
  - each new `src/styles/<x>.css` is `@import`ed by `globals.css` into `layer(components)`, and listed in its task's Files [C16];
  - no selector repeats within or across `src/styles/*.css` (`css-hygiene.test.ts`, C12);
  - keep the prototype class names; write `var(--color-line-strong)`, never `var(--line-strong)` (the prototype's `.qty` and `.drop` use the latter) [C13];
  - motion animates only `transform` and `opacity`, with a static state under reduced motion.
- **Cache Components:**
  - no root-layout Suspense;
  - a `usePathname` caller gets its own leaf Suspense with a static fallback;
  - request-time reads go after `connection()` inside a leaf Suspense;
  - the K and R pages are static shells whose per-user content is fetched on the client after hydration, like the header session;
  - `ensureStatic = "navigation"` is only for `[slug]` pages, so none is needed here.
- **Hydration:** no `sessionStorage`, `window` or `location` read during render; stores serve a frozen server snapshot through `useSyncExternalStore`.
- **Routes map:** link through `ROUTES`. A linked page that is not built yet is listed in `PENDING_ROUTES` (`e2e/links.spec.ts` expects a 404); the task that builds it deletes the entry and adds the page to `START`.
- **Mocks:** forbidden in production, exactly as `isMockForbidden()` decides; from R3, `FILE_STORE=memory` and `FILE_STORE=local` count as mocks.
- **Budgets:** product pages keep their 170 kB first-load JS ratchet (the 150 kB target was superseded, 2026-11-27) and the home its 175 kB ratchet (`e2e/budgets.spec.ts`). `@vercel/blob/client` is dynamically imported on the first upload only.

Business values, used verbatim:
- **Cart caps:** `CART_LIMITS = { perProduct: 10, perOrder: 20 }`. An add that would exceed either cap changes nothing.
- **Cart totals:** MRP total = Σ mrpPaise × qty; discount = 2000 × packs (`MRP_DISCOUNT_PAISE`); delivery 0, shown as "Free"; payable = Σ `sellingPricePaise(mrpPaise)` × qty. "Inclusive of all taxes".
- **Rx files:** JPG, PNG, WebP or PDF, decided by magic bytes. 1 to `8_388_608` bytes (8 MiB; 8,388,609 is refused). Images are re-encoded to WebP quality 85, longest side ≤ 3000 px (never enlarged), shortest side ≥ 400 px, input ≤ 50,000,000 pixels, a single frame, EXIF orientation applied and all metadata dropped. PDFs: ≤ 20 pages, no encryption, no active content.
- **Rx validity:** 6 calendar months from the Rx date on the IST wall clock, end exclusive (`isRxValidOn`, `addCalendarMonthsIst`). `rxDate` is stored as IST midnight (`istMidnight`) [carry]. The pharmacist's "valid until <day>" is stored as the next IST midnight [carry], capped at rxDate + 6 months.
- **Rx statuses:** stored `pending | approved | rejected`; shown as "Under review" / "Approved · valid until <d MMM yyyy>" / "Expired on <d MMM yyyy>" (derived) / "Rejected".

## Review Focus

1. **Two tabs or a fast double tap racing cart writes at the caps.** Expected: the stored cart never exceeds 10 of one product or 20 packs, no write is lost, and a refused add leaves the cart unchanged. Test: Task K2, 25 parallel `addToCart` calls → exactly 20 packs, and 15 parallel adds of one slug → 10.
2. **The guest merge replayed** (a retried request after a 4G drop, two tabs signing in, or a login event plus a mount both firing). Expected: merging the same guest cart twice gives the same cart as once, and nothing doubles. Tests: Task K1 `mergeLines(mergeLines(s, g), g)` equals `mergeLines(s, g)`; Task K3, two parallel `POST /api/cart/merge` calls with the same lines → one result.
3. **A disguised or hostile upload:** an HTML or SVG file named `.jpg`, a JPEG with a script appended after the end-of-image marker, a 20,000 × 20,000 "pixel bomb" PNG, an animated WebP, a PDF whose JavaScript key is hex-escaped (`/J#53`), or an encrypted PDF. Expected: each is refused with its named error, or (the appended bytes) re-encoded away, and nothing is stored. Test: Task R2 fixture table.
4. **Reading someone else's prescription:** another user's id, a malformed id, a deleted record, or a staff customer-kind session. Expected: the same `404 not_found` as a missing record, so there is no existence oracle, and no audit row for a refused read. Test: Task R5.
5. **A product's MRP changed or the product retired while it sits in a cart.** Expected: the cart shows the new MRP-derived price on the next read (never a cached page price); a retired product drops out once, with one announcement; totals never include it. Tests: Task K2 (`getCart` after a raw `updateOne` of `mrpPaise`, and after `active: false`); Task K4 (one announcement).

## Decisions taken in this plan (rulings; override any)

Each line gives the ruling, its reason and the cost if it is wrong. Copy them into `docs/decisions/rulings.md` in the docs PR that commits this plan (`docs/decisions/**` is outside the size cap).

**Cart**
- **Ruling:** the pure cart rules move to `src/server/cart/rules.ts`, and `cart/rules` joins the client-import allowlist with `catalogue/pricing`, `search` and `order`. Server and client must apply identical caps, and `src/lib/cart/cart.ts` re-exports them. Cost: one more allowlisted module.
- **Ruling:** a cart is one document per user, `_id` = the user's ObjectId, holding `lines: { slug, qty }[]` in add order and an integer `rev`. Every write is a compare-and-set on `rev`, retried up to 3 times, after which it returns 409 `cart_conflict`. Caps span lines, so a single `$inc` cannot enforce the 20-pack cap. Cost: a retry under heavy contention.
- **Ruling (provisional):** the guest merge takes, per slug, **the larger** of the server and guest quantities (not the sum). Server lines keep their order, new guest slugs follow, and anything over 20 packs is trimmed from the end (`trimmed: true`). Max is idempotent, so a replayed merge cannot double a cart (Review Focus 2). Cost if wrong: a guest who added one more pack of a product already in their account cart sees the account quantity; they tap + once.
- **Ruling:** adds and sets are all-or-nothing at the caps: adding 3 packs to 9 is refused with `product_limit` rather than clamped to 10. This matches the current UI's refuse-and-explain behaviour. Cost: none.
- **Ruling:** cart routes require a signed-in user (401 otherwise). Guests price their `sessionStorage` lines through the unauthenticated, rate-limited `POST /api/cart/quote`, which writes nothing. Cost: one more public endpoint (60 per minute per IP bucket).
- **Ruling (provisional):** guest storage moves to `sessionStorage` key `aarv-cart-guest-v1` with shape `{ "lines": [{ "slug", "qty" }] }`. The old `aarv-cart-ui-v0` key is removed on first load and not migrated: it is pre-launch, with no real carts. Cost if wrong: preview testers lose a test cart once.
- **Ruling:** when a signed-in request gets 401 (session expired), the store drops to guest mode with an empty guest cart; the server cart waits for the next sign-in. Cost: none.
- **Ruling:** `/cart` and the drawer read prices from the quote or cart API (Mongo), never from the page's cached catalogue. The empty state's "Browse all N medicines" count may come from `getCachedProducts()`, because it is not a price. Cost: none.
- **Ruling:** the checkout button links to `ROUTES.checkout = "/checkout"`, added to `PENDING_ROUTES` until phase O. A guest goes to `/login?next=/checkout`. "Reorder a past order" is omitted from the empty state until O builds order history. Cost: none.
- **Ruling:** cart receipt notes while `onlinePayments` is false: "Pay cash on delivery for orders up to ₹5,000." The prototype's online-payment and full-refund lines render only when the flag is true. Cost: one flag flip at go-live.
- **Ruling:** Rx and non-Rx groups: the Rx group keeps the prototype head ("Prescription medicines", with the pharmacist line). The non-Rx head is "Medicines without a prescription" (awaiting owner approval) and renders only when it has lines; none exist today. Cost: one string.
- **Ruling:** the prototype's line stepper class `.qty` collides with `CartControl`'s `span.qty`, so the cart line stepper ports as `.line-stepper`, with a `<span>` count, never `<output>`. Cost: none.
- **Ruling (coordinator, 2026-11-27):** the drawer stays in scope as Task K7, because spec §5.5 and the master plan's K row name it. A plain click on `CartPill` opens it; a modified click follows `href="/cart"`. Cost: one more PR.

**Prescriptions**
- **Ruling (provisional):** uploads are staged in three steps (staging slot → transfer → finalise), because Vercel functions accept at most 4.5 MB of request body and the owner set 8 MB. With `FILE_STORE=blob` the browser uploads straight to Vercel Blob (private) under the server-issued key `rx-staging/<userId>/<stagingId>`, using a client token from `POST /api/prescriptions/blob-token` that limits the pathname, content types, 8 MiB size and expiry. With `memory` or `local` the browser `PUT`s to `/api/prescriptions/staging/<id>`, which answers 404 under `blob`. Cost if wrong: the dev and production transfer paths differ, so e2e never exercises Blob. A preview smoke (Task R7) covers it.
- **Ruling (coordinator, 2026-11-27): the fallback when Blob cannot take private client uploads.** If the installed `@vercel/blob` does not support private client uploads, R5 does not stop. It switches to a **chunked upload through our own route**: the browser sends the file in parts of at most 4 MiB each (every request under Vercel's 4.5 MB body limit) to `PUT /api/prescriptions/staging/[id]/parts/[n]` (n = 0..2, since 8 MiB fits in 3 parts). Each part is stored under `rx-staging/<userId>/<stagingId>/<n>`. The staging slot records the expected part count and total bytes, fixed by `POST /api/prescriptions/staging` from the client's declared size (≤ `RX_MAX_BYTES`). On finalise the server reassembles the parts in order and refuses a missing part, an extra part or a total over 8 MiB. It then validates and stores the file exactly as in the single-file path and deletes the parts. `mode` becomes `"chunked"`, the `blob-token` route is not built, and the same chunked path serves `memory` and `local`, so e2e exercises the production path. Cost: three requests per large file and more route code. Split R5 into R5a (parts routes) and R5b (the rest) if it passes 400 lines.
- **Ruling (provisional):** storage providers and env names:
  - `FILE_STORE=blob` reads `BLOB_READ_WRITE_TOKEN` (the name Vercel sets when a Blob store is connected). Preview and Production each get their own private store, and Production's is created in the Mumbai region (`bom1`) if offered.
  - `FILE_STORE=local` writes under `FILE_STORE_LOCAL_DIR`, default `.data/files` (gitignored), for `pnpm dev`.
  - `FILE_STORE=memory` stays the test and e2e default.
  - `memory` and `local` are refused when `isMockForbidden()`, and also whenever `VERCEL_ENV` is set, since they do not persist across functions.

  Cost if wrong: env renames in Vercel; data residency is the owner's legal call (S3 Mumbai remains the master plan's fallback).
- **Ruling (provisional):** keys hold no personal data. Final files are `rx/<userIdHex>/<rxIdHex>.<webp|pdf>`. **The original file name is not stored** (DPDP data minimisation: names like `rahul-9876543210.jpg` leak identity into storage and staff tooling). The list shows "Photo" or "PDF · N pages" and the upload date. Cost: a customer cannot see their own file name.
- **Ruling (provisional):** images are re-encoded to WebP at quality 85, longest side ≤ 3000 px, shortest side ≥ 400 px, ≤ 50 MP input, first frame only (animated input refused), sRGB, all metadata dropped. Handwriting stays legible at quality 85 and 3000 px, and a re-encode destroys polyglot payloads. Cost: one constant each.
- **Ruling (provisional):** PDFs are not re-rendered (no PDF dependency in v1). They are checked byte-wise:
  - a `%PDF-1.0`–`%PDF-2.0` header at offset 0;
  - `%%EOF` within the last 1024 bytes;
  - ≤ 20 `/Type /Page` objects;
  - none of the names `/Encrypt`, `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`, `/EmbeddedFiles`, `/RichMedia`, `/XFA`, `/SubmitForm`, `/ImportData` after `#xx` hex escapes in names are decoded.

  The file is served with a `sandbox` CSP and `nosniff`. Cost if wrong: active content hidden inside compressed object streams passes the scan, and PDF metadata (author, creator) is kept. Both are listed for phase H.
- **Ruling:** the stored status is `pending | approved | rejected`, the names `RxSnapshot` in `validity.ts` already uses. "Expired" is derived from `now`, never stored. Transitions: `pending → approved` (doctor name, registration number, Rx date, optional valid-until); `pending → rejected` (reason code and optional note); `approved → rejected` (a revocation, `revoked: true`). `rejected` is final. Staff roles and audit are phase D; the pure function and the conditional update are defined and tested here. Cost: a wrongly rejected Rx needs a new upload.
- **Ruling (provisional):** rejection reasons are a fixed code list (`unreadable | outdated | incomplete | patient_mismatch | not_prescription | other`) plus an optional staff note of at most 500 characters. The note is shown only on the customer's own account page, never in SMS, email or logs (spec §5.7). Cost: one enum.
- **Ruling (provisional):** the patient name uses the sign-up name rule (2–80 characters, a letter, no hidden characters), exported as `PersonName` from `src/server/auth/login.ts`. The declaration text is pinned with `RX_DECLARATION_VERSION = "2026-11-27"` and stored as `{ version, at }`. Cost: none.
- **Ruling (provisional):** upload limits are 10 staging slots per user per hour and 30 per IP bucket per hour. A staging slot lives 15 minutes and is single use. File reads are limited to 120 per user per hour. Cost: a few numbers.
- **Ruling (provisional):** every successful file read is audited `rx.view` (actor = the reader), and every upload `rx.upload`. Spec §6 asks for every view; it is cheap to add now. Cost: one audit row per view.
- **Ruling:** `/account/prescriptions` (`ROUTES.uploadRx`) is a static shell. The list and the form load on the client. A signed-out visitor sees a sign-in panel whose button calls `openLogin(ROUTES.uploadRx)`, falling back to `/login?next=/account/prescriptions` without JS. There is no account tab rail until P1 builds `/account`, which stays in `PENDING_ROUTES`. Cost: P1 wraps the page in its tabs later.
- **Ruling:** the "Under review" explanation drops the prototype's "We’ll text you when it’s done." because notifications are phase N. N restores it. Cost: one string.
- **Ruling (provisional):** abandoned staging files are not swept in this phase. Their keys are under `rx-staging/` and their Mongo slots expire by TTL. The sweep (delete `rx-staging/` blobs older than 1 h) is carried to N's cron. Cost: a few orphaned private blobs until N.

## File Structure

```
src/server/cart/                rules.ts (pure, client-safe) carts.ts (CAS repo) service.ts (priced views)
src/server/catalogue/           pricing.ts (+ cartTotals) queries.ts (+ getPurchasableBySlugs)
src/server/auth/                guards.ts (+ sessionRefreshHeaders) login.ts (+ export PersonName)
src/server/prescriptions/       validity.ts (+ istMidnight, istDay, rxEnd) review.ts (pure transitions, view)
                                file-check.ts (sniff, sharp re-encode, PDF scan) prescriptions.ts (repo, staging)
                                upload.ts (start, finish)
src/server/providers/           types.ts (FileStore.kind) local-files.ts blob-files.ts
src/server/http.ts              (+ readCappedBytes)
src/app/api/cart/               route.ts items/route.ts items/[slug]/route.ts merge/route.ts quote/route.ts
src/app/api/prescriptions/      route.ts staging/route.ts staging/[id]/route.ts blob-token/route.ts [id]/file/route.ts
src/app/(store)/cart/page.tsx
src/app/(store)/account/prescriptions/page.tsx
src/lib/cart/                   cart.ts (adapter) store.ts (guest + server sync) api.ts use-cart-view.ts
src/components/cart/            cart-control.tsx cart-pill.tsx cart-sync.tsx (replaces cart-reconcile.tsx)
                                cart-line.tsx cart-summary.tsx cart-page.tsx cart-drawer.tsx load-cart-drawer.ts cart-copy.ts
src/components/rx/              rx-copy.ts prepare-file.ts rx-api.ts rx-upload-form.tsx rx-list.tsx rx-page.tsx
src/styles/                     notes.css cart.css rx.css
tests/helpers/                  http.ts (+ jsonReq, bytesPut) session.ts (signedIn) rx-fixtures.ts
e2e/                            cart.spec.ts prescriptions.spec.ts
```

New collections: `carts`, `prescriptions`, `rx_staging`.

**Order and parallelism** (each arrow is "merged before"):
- Wave 1, all in parallel with disjoint files: **K1**, **R1**, **R2**, **R3**.
- Then K1 → **K2** → **K3** → **K4** (also needs PR #171) → **K5** → **K6** → **K7**.
- Then R1 + R2 + R3 → **R4** → **R5** → **R6** → **R7** (also needs PR #171).
- K and R are independent after wave 1, so K2–K7 run beside R4–R7 on separate worktrees.
- **KR8** (the finish-review gate) runs last.
- Hotspots, so merge serially and merge `origin/main` before the last push:
  - `src/config/routes.ts` and `e2e/links.spec.ts` (K6, R7);
  - `src/app/globals.css` (K5, R6);
  - `src/server/audit.ts` and `register-all.ts` (R4);
  - `env.ts` and `deps.ts` (R3);
  - `login.ts` (R4);
  - CHANGELOG and architecture.md (all).

---

### Task K1: Pure cart rules and cart totals (PR `feat/cart-rules`)

**Files:**
- Create: `src/server/cart/rules.ts`, `src/server/cart/rules.test.ts`.
- Modify:
  - `src/server/catalogue/pricing.ts` (`cartTotals`) and `pricing.test.ts`;
  - `src/lib/cart/cart.ts` (re-export `CART_LIMITS` and `CartBlock` from rules; `applyCart` delegates to `addLine`/`setLineQty`);
  - `src/components/server-imports.test.ts` (allow `cart/rules`);
  - `docs/dev/architecture.md` (bullets for `rules.ts` and `pricing.ts`), `docs/dev/data.md` (Prices), `CHANGELOG.md`.

**Interfaces:**
- Produces (`rules.ts`, no imports beyond types):
  - `CART_LIMITS = { perProduct: 10, perOrder: 20 } as const`
  - `type CartLine = { slug: string; qty: number }`; `type CartBlock = "product_limit" | "order_limit"`
  - `type CartChange = { lines: readonly CartLine[]; blocked: CartBlock | null }`. A refused change returns the **same array** it was given.
  - `cartPacks(lines): number`
  - `addLine(lines, slug, n = 1): CartChange`, where `n` is an integer 1..10; a new slug appends.
  - `setLineQty(lines, slug, qty): CartChange`, where `qty` is an integer 0..10; 0 removes; an absent slug with qty > 0 appends.
  - `removeLine(lines, slug): CartChange`
  - `capLines(raw: readonly unknown[]): { lines: CartLine[]; trimmed: boolean }`: keeps `{ slug: string, qty: int ≥ 1 }` entries (the first entry wins on a duplicate slug), clamps qty to 10, and cuts at 20 packs from the end.
  - `mergeLines(server, guest): { lines: CartLine[]; trimmed: boolean }`: max per slug, server order first, then `capLines`.
- Produces (`pricing.ts`): `type CartTotals = { packs: number; mrpPaise: number; discountPaise: number; discountPerPackPaise: number; deliveryPaise: 0; payablePaise: number }` and `cartTotals(items: readonly { mrpPaise: number; qty: number }[]): CartTotals`. Payable is Σ `sellingPricePaise(mrpPaise)` × qty; an invalid MRP throws `RangeError`, as `sellingPricePaise` does.

- [ ] **Step 1: Write the failing tests**
  - `rules.test.ts`:
    - `addLine([], "a")` → `[{a,1}]`;
    - `addLine([{a,9}], "a", 3)` → `blocked: "product_limit"` and `toBe` the input;
    - `[{a,10},{b,10}]` + `c` → `"order_limit"`;
    - `setLineQty([{a,2}], "a", 0)` → `[]`;
    - `setLineQty([{a,10},{b,9}], "b", 10)` → `"order_limit"`;
    - `removeLine` on a missing slug returns the input, `blocked: null`;
    - `capLines([{a,12},{a,1},{b:"x"},{c,10}])` → `[{a,10},{c,10}]`, `trimmed: false`;
    - `capLines` of 3 × `{qty:10}` → 20 packs, `trimmed: true`;
    - `mergeLines([{a,2}], [{a,1},{b,3}])` → `[{a,2},{b,3}]`;
    - idempotence (Review Focus 2): `mergeLines(mergeLines(s,g).lines, g)` deep-equals `mergeLines(s,g)` for 3 fixed pairs;
    - a slug `"__proto__"` is an ordinary line.
  - `pricing.test.ts`: `cartTotals([{mrpPaise:40700,qty:2},{mrpPaise:26300,qty:1}])` equals `{ packs:3, mrpPaise:107700, discountPaise:6000, discountPerPackPaise:2000, deliveryPaise:0, payablePaise:101700 }`; `cartTotals([])` gives all zeros (except `discountPerPackPaise` 2000); `mrpPaise 2099` throws `RangeError`.
  - `server-imports.test.ts`: a fixture importing `@/server/cart/rules` at runtime passes; `@/server/cart/carts` still fails.
  - The existing `src/lib/cart/cart.test.ts` passes unchanged.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/cart src/server/catalogue/pricing.test.ts src/components/server-imports.test.ts src/lib/cart`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the signatures above; `applyCart` converts record ⇄ lines at its boundary.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(cart): add shared cart rules and server cart totals`.

### Task K2: Server cart store, priced views and the sliding-cookie helper (PR `feat/cart-store`)

**Files:**
- Create: `src/server/cart/carts.ts`, `src/server/cart/service.ts`, `tests/helpers/session.ts`, `tests/int/cart-service.test.ts`.
- Modify:
  - `src/server/catalogue/queries.ts` (`getPurchasableBySlugs`);
  - `src/server/auth/guards.ts` (`sessionRefreshHeaders`);
  - `docs/dev/architecture.md` (bullets, plus a `carts` row in Collections), `docs/dev/testing.md` (helper row), `CHANGELOG.md`.

**Interfaces:**
- Consumes: K1 `rules.ts` and `cartTotals`; `getDb`; `Slug`, `ProductImage`, `CompositionItem`.
- Produces:
  - `CARTS_COLLECTION = "carts"`; `type CartDoc = { _id: ObjectId; lines: CartLine[]; rev: number; createdAt: Date; updatedAt: Date }`. No secondary index, so there is no `register-all` entry.
  - `readCart(userId: ObjectId): Promise<CartDoc | null>`
  - `mutateCart(userId, now, fn: (lines: readonly CartLine[]) => { lines: readonly CartLine[]; blocked?: CartBlock | null; trimmed?: boolean }): Promise<{ lines: CartLine[]; blocked: CartBlock | null; trimmed: boolean }>`:
    - when the function returns its input array, it writes nothing;
    - a missing cart is inserted with `rev: 1`, and an E11000 retries;
    - otherwise `updateOne({ _id, rev }, { $set: { lines, updatedAt }, $inc: { rev: 1 } })`;
    - after 3 lost races it throws `HttpError(409, "cart_conflict")`.
  - `getPurchasableBySlugs(slugs: string[]): Promise<Map<string, PurchasableProduct>>`, a direct Mongo read (never cached) of `active: true` products in live categories, where `PurchasableProduct = Pick<PublicProduct, "slug" | "name" | "packLabel" | "dosageForm" | "composition" | "rxRequired" | "mrpPaise"> & { image: ProductImage }` (the cutout, else the first photo).
  - `type PricedLine = PurchasableProduct & { qty: number }`; `type CartView = { lines: PricedLine[]; totals: CartTotals; removed: string[] }`.
  - `type CartResult = { ok: true; cart: CartView } | { ok: false; error: "product_not_found" | CartBlock; cart: CartView }`.
  - `getCart(userId, now): Promise<CartView>`: lines whose product is no longer purchasable are removed in the same CAS write and listed in `removed` (Review Focus 5).
  - `addToCart(userId, slug, n, now)`, `setCartQty(userId, slug, qty, now)` and `removeFromCart(userId, slug, now)`, each `Promise<CartResult>`. An unknown or retired slug returns `product_not_found` with no write; `removeFromCart` of an absent slug is `ok`.
  - `mergeGuestCart(userId, guest: CartLine[], now): Promise<CartView & { trimmed: boolean }>`: unknown guest slugs are dropped before `mergeLines`.
  - `quoteLines(lines: CartLine[]): Promise<CartView>`: no write; non-purchasable slugs go to `removed`.
  - `sessionRefreshHeaders(auth: AuthContext): Headers`: `Set-Cookie: sessionCookieHeader(token, "customer")` when `auth.refreshed && auth.session.kind === "customer"`, else empty.
  - `tests/helpers/session.ts`: `signedIn(opts?: { role?: Role; phone?: string }): Promise<{ user: UserDoc; cookie: string }>`, made through `findOrCreateUserByIdentifier` and `createSession`.

- [ ] **Step 1: Write the failing tests** (`tests/int/cart-service.test.ts`; seed the catalogue with `tests/helpers/catalogue.ts`; clock from `installClock`)
  - `addToCart(u, "sacuwin-100", 2)` → `ok`; `cart.totals` equals `cartTotals([{40700,2}])`; the stored doc has `lines: [{slug:"sacuwin-100",qty:2}]`, `rev: 1` and **no price field anywhere**: `JSON.stringify(doc)` has no `Paise`.
  - `addToCart(u, "nope")` → `product_not_found` with no doc written. A product in a coming-soon category also gets `product_not_found`.
  - Caps: 10 then +1 → `product_limit`, `rev` unchanged; 20 packs across slugs then +1 → `order_limit`.
  - **Review Focus 1:** 25 parallel `addToCart` calls over three slugs (each slug gets at least 7 adds) → the final doc has exactly 20 packs, no slug over 10, and `rev` = 1 + the number of `ok` results. 15 parallel adds of one slug → 10.
  - `setCartQty(u, slug, 0)` removes; `removeFromCart` of an absent slug → `ok`.
  - **Review Focus 5:** after a raw `products.updateOne({ slug: "sacuwin-100" }, { $set: { mrpPaise: 50000 } })`, `getCart` totals use 50000. After `{ active: false }`, `getCart` returns `removed: ["sacuwin-100"]`, the line is gone from the doc, and a second `getCart` returns `removed: []`.
  - `mergeGuestCart(u, [{a,1},{b,3},{ghost,2}])` over a server `[{a,2}]` → `[{a,2},{b,3}]`. Merged twice → the same lines and the same totals.
  - `quoteLines` writes no `carts` document.
  - `sessionRefreshHeaders`: a customer auth with `refreshed: true` gives a header containing `Max-Age=2592000`; `refreshed: false`, or a staff session, gives none.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/cart-service.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `carts.ts`, `getPurchasableBySlugs` (a `{ slug: { $in } }` filter of zod-parsed `Slug`s, ≤ 20 entries), `service.ts` and the guard helper.
- [ ] **Step 4: Run** the Step 2 command (expected: PASS), then the full local check.
- [ ] **Step 5: Commit**
  - `feat(cart): add the compare-and-set cart store and priced cart views`;
  - `feat(auth): add sessionRefreshHeaders for customer routes`.

  Split seam if the PR is over 400 lines: move the guard helper and `session.ts` helper into a first PR.

### Task K3: Cart API routes (PR `feat/cart-api`)

**Files:**
- Create:
  - `src/app/api/cart/route.ts` (GET), `items/route.ts` (POST), `items/[slug]/route.ts` (PUT, DELETE), `merge/route.ts` (POST), `quote/route.ts` (POST);
  - `tests/int/cart-routes.test.ts`.
- Modify:
  - `tests/helpers/http.ts` (`jsonReq(method, path, body, opts)`);
  - `docs/dev/architecture.md` (one bullet per route, plus rate-limit keys), `CHANGELOG.md`.

**Interfaces:**
- Consumes: K2 service and `sessionRefreshHeaders`; `requireUser`, `hitRateLimit`, `clientIp`/`ipBucket`, `readJson`, `withErrors`, `assertSameOrigin`.
- Produces (every response `no-store`, plus the K2 refresh header):
  - `GET /api/cart` → 200 `CartView` | 401 `unauthenticated`.
  - `POST /api/cart/items` `{ slug: Slug, qty: int 1..10 }` (packs to add).
  - `PUT /api/cart/items/[slug]` `{ qty: int 0..10 }`.
  - `DELETE /api/cart/items/[slug]`.
  - Responses of the three above: 200 `CartView`; 404 `{ error: "product_not_found", cart }`; 409 `{ error: "product_limit" | "order_limit", cart }`; 409 `{ error: "cart_conflict" }`; 400 `invalid_request` (a bad `[slug]` included).
  - `POST /api/cart/merge` `{ lines: { slug: Slug, qty: int 1..10 }[] (max 20 entries) }` → 200 `CartView & { trimmed }`.
  - `POST /api/cart/quote` (no auth) with the same body → 200 `CartView`.
  - Rate limits: mutations `cart:user:<userIdHex>` 120 per 60 s; quote `cart-quote:ip:<bucket>` 60 per 60 s; both answer 429 `rate_limited` with `Retry-After`.
  - Client-facing types: `CartView`, `PricedLine`, `CartTotals`, re-exported as types from `src/server/cart/service.ts`.

- [ ] **Step 1: Write the failing tests** (`tests/int/cart-routes.test.ts`, calling the handlers directly)
  - No cookie: GET and POST items → 401. POST without `Origin` → 403 `bad_origin`.
  - With `signedIn()`: POST items `{slug:"sacuwin-100",qty:2}` → 200, `lines[0].qty === 2`, `cache-control: no-store`. PUT `{qty:0}` → 200 with an empty cart. DELETE twice → 200 both times.
  - The route `[slug]` `"Bad Slug"` → 400. `qty: 11` → 400. A 21-entry merge body → 400.
  - At 10: POST items → 409 `{ error: "product_limit", cart: { lines: [{ qty: 10 }] } }`.
  - **Review Focus 2:** two parallel merge POSTs with the same guest lines → both 200 with identical `lines`; the stored `rev` is at most 3.
  - The session slid (advance the clock 2 min): GET has `Set-Cookie` with `Max-Age=2592000`. At +30 s it has none.
  - Quote: no cookie → 200 priced lines; the 61st call from one IP bucket within 60 s → 429 with `Retry-After`. Quote writes no `carts` document.
  - A console spy over the whole file sees no slug, phone or cookie value in `console.error` arguments.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/cart-routes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** thin handlers: Origin → `requireUser` → rate limit → `readJson` → service → `jsonResponse(view, { status, headers: sessionRefreshHeaders(auth) })`. The GET starts with `await connection()`.
- [ ] **Step 4: Run** it (expected: PASS), `pnpm exec vitest run --project unit src/server/route-config.test.ts`, then the full local check.
- [ ] **Step 5: Commit** `feat(cart): add the cart, merge and quote API routes`.

### Task K4: Client cart store on the server cart, with guest merge at sign-in (PR `feat/cart-sync`)

**Depends on:** K3, and PR #171 merged (`LOGIN_EVENT`, `openLogin`).

**Files:**
- Create: `src/lib/cart/api.ts`, `src/lib/cart/api.test.ts`, `src/components/cart/cart-sync.tsx`, `src/components/cart/cart-sync.test.tsx`, `src/components/cart/cart-copy.ts` (`CART_COPY`: the limit sentences moved out of `cart-control.tsx`, plus the K4 announcements).
- Modify:
  - `src/lib/cart/store.ts` and `src/lib/cart/cart.test.ts` (store cases);
  - `src/components/shell/store-chrome.tsx` (`CartSync` replaces `CartReconcile`);
  - delete `src/components/cart/cart-reconcile.tsx`;
  - `src/app/(store)/login/page.tsx` (restore the cart line in `WHY`) and `page.test.tsx`;
  - `docs/dev/architecture.md` (`src/lib/cart/` and `cart/` bullets), `CHANGELOG.md`.

**Interfaces:**
- Consumes: K3 routes (types via `import type`); `fetchSession` (`src/components/auth/api.ts`); `LOGIN_EVENT` (#171); `announce`.
- Produces:
  - `api.ts`, where nothing throws and the 15 s timeout matches `auth/api.ts`: `getCart()`, `addItem(slug, qty)`, `setQty(slug, qty)`, `removeItem(slug)`, `mergeCart(lines)` and `quoteCart(lines)`, each `Promise<CartApiResult>`, where `type CartApiResult = { ok: true; view: CartView & { trimmed?: boolean } } | { ok: false; error: "unauthenticated" | "product_not_found" | "product_limit" | "order_limit" | "rate_limited" | "network"; view?: CartView }`.
  - `cartStore` keeps `subscribe`, `getSnapshot(): CartLines`, `getServerSnapshot()` and `dispatch(action): CartBlock | null`. `CartAction` gains `{ type: "set"; slug; qty }` and `{ type: "remove"; slug }`. It adds:
    - `getMode(): "unknown" | "guest" | "user"`;
    - `getView(): CartView | null`: the last priced view, for K5;
    - `signIn(): Promise<{ trimmed: boolean; removed: string[] }>`: merges any guest lines (`mergeCart`), else `getCart`; then clears guest storage and switches to user mode;
    - `toGuest(): void`;
    - `reconcile(known)`, which stays for guest mode;
    - `onIssue(listener: (issue: CartIssue) => void): () => void`, where `type CartIssue = { kind: "removed"; slugs: string[] } | { kind: "refused"; error: CartBlock | "product_not_found" } | { kind: "sync_failed" } | { kind: "trimmed" }`.
  - Behaviour:
    - In **guest** mode `dispatch` writes `aarv-cart-guest-v1` (`{ lines }`) and removes `aarv-cart-ui-v0`.
    - In **user** mode it applies the K1 rule locally at once (optimistic), then queues one request at a time (a promise chain). The server's view replaces the lines when each request settles. A refusal or `network` result reverts to the last server lines and emits an issue; a 401 calls `toGuest()`.
    - In guest mode every change re-quotes with 150 ms trailing debounce, so `getView()` stays priced.
  - `CartSync({ slugs })`, mounted by `withStoreChrome()`, renders nothing. It:
    - on mount, runs `fetchSession()`, then `signIn()` when signed in, else guest mode plus `reconcile(new Set(slugs))`;
    - on `LOGIN_EVENT`, runs `signIn()`;
    - announces each issue once: removed → "A medicine in your cart is no longer available, so it was removed." (the existing string); trimmed → "Your cart was full, so some packs weren’t added."; sync_failed → "We couldn’t update your cart. Check your connection and try again."; refused → the existing `CartControl` limit sentences (moved to `cart-copy.ts` as `CART_COPY`).
  - The login page's `WHY` gains `{ icon: "cart", text: "Your cart stays as it is when you sign in." }`, verbatim from the prototype's `[data-cart-keep]` [carry K1].

- [ ] **Step 1: Write the failing tests**
  - `api.test.ts` (mocked `fetch`): a 409 body `{error:"order_limit",cart}` → `{ ok:false, error:"order_limit", view }`; a timeout → `network`; a non-JSON 200 → `network`; a 401 → `unauthenticated`.
  - `cart.test.ts` store cases:
    - guest dispatch writes the v1 key and removes v0;
    - two `getSnapshot()` calls without a change return the same object (`toBe`);
    - user mode: `dispatch(inc)` updates the snapshot synchronously; a mocked 409 `product_limit` reverts to the server lines and emits `refused`;
    - three rapid dispatches send three requests **in order**, with at most one in flight;
    - a 401 switches to guest with `{}`;
    - `signIn()` with guest `{a:1}` calls `mergeCart([{slug:"a",qty:1}])` once and clears guest storage. A second `signIn()` call while the first is pending reuses its promise (Review Focus 2).
  - `cart-sync.test.tsx`: signed-out `fetchSession` → guest mode and reconcile; firing `LOGIN_EVENT` calls `signIn` once; a `trimmed` result announces the trimmed sentence through `#live`.
  - `login/page.test.tsx`: the page lists "Your cart stays as it is when you sign in."
  - The existing `cart-control.test.tsx` passes unchanged: hydration from the server snapshot, focus moves and announcements.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/lib/cart && pnpm exec vitest run --project ui src/components/cart "src/app/(store)/login"`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check. The home JS ratchet and the product 150 KB budget must still pass.
- [ ] **Step 5: Commit**
  - `feat(cart): back the cart store with the server cart and merge the guest cart at sign-in`;
  - `feat(auth): restore the cart line on the login page`.

  Split seam if the PR is over 400 lines: `api.ts` and its tests first.

### Task K5: Cart line, summary and the priced view hook (PR `feat/cart-lines-summary`)

**Files:**
- Create:
  - `src/lib/cart/use-cart-view.ts`;
  - `src/components/cart/cart-line.tsx`, `cart-summary.tsx`, `cart-line.test.tsx` (K5 adds its line strings to K4's `cart-copy.ts`);
  - `src/styles/notes.css`: port `design/prototype/css/flows.css` lines 193–205 (`.note*`);
  - `src/styles/cart.css`: port flows.css 474–544 (cart lines, `.qty` renamed `.line-stepper`, receipt, sum, cart page grid) and 553–564 (`.dock`). Skip `.empty*`, which `empty.css` owns, and any selector `css-hygiene` reports as already present.
- Modify: `src/app/globals.css` (two imports) [C16], `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: `cartStore.getView()`, `useCartLines`, `cartTotals` and `CART_LIMITS` (allowed runtime imports), `Rupees`, `StampPrice`/`PriceInline`, `RxBadge`, `Icon`, `announce`.
- Produces:
  - `useCartView(): { lines: PricedLine[]; totals: CartTotals; pending: string[] }`: joins the current `CartLines` quantities with the last priced facts per slug. Totals come from `cartTotals` over the joined lines. A slug not yet priced is in `pending` and left out of the totals. The server snapshot is empty.
  - `CartLineItem({ line, variant: "full" | "compact" })` renders the prototype's `lineEl` markup:
    - `li.line[data-slug]`, `span.well`, `.line-main` (name + `RxBadge` when `rxRequired`, the composition via `fullComposition`, the pack);
    - `.line-price`: struck MRP × qty, price × qty, and "₹X each" when qty > 1, all through the price components;
    - `.line-ctl`: `div.line-stepper[role=group][aria-label="Quantity of <name>"]` with `[data-dec]` "One fewer <name>" (`aria-disabled` at 1), a `span` count, and `[data-inc]` "One more <name>" (`aria-disabled` at either cap); `button.line-remove` "Remove <name> from cart" (with the "Remove" text in `full`); and `span.line-max`, which reads "Up to 10 of each per order" or "20-pack order limit reached" at a cap.

    Its actions are `cartStore.dispatch({ type: "set" | "remove" })` and its announcements reuse `CART_COPY`.
  - `CartSummary({ totals, kind: "full" | "mini" })` renders the prototype's `sumHTML` verbatim: "MRP total"; "Aarvion discount" with `<small>₹20 × N packs</small>` (rendered from `discountPerPackPaise` with `Rupees`); "Delivery" "Free"; "Total payable"; and "Inclusive of all taxes". The mini kind is "MRP ₹… less ₹… Aarvion discount / Free delivery · Inclusive of all taxes".

- [ ] **Step 1: Write the failing tests** (`cart-line.test.tsx`)
  - A line `{ sacuwin-100, qty 2, mrp 40700 }` shows "₹814" struck, "₹774" and "₹387 each".
  - `[data-dec]` at qty 1 is `aria-disabled`; at 10, `[data-inc]` is `aria-disabled` and `.line-max` reads "Up to 10 of each per order".
  - Remove dispatches `{type:"remove"}` and announces "Sacuwin 100 removed from cart" through `#live`.
  - The DOM has no `output` and no `[aria-live]`.
  - `CartSummary` full, for the K1 totals example, reads "MRP total ₹1,077", "Aarvion discount ₹20 × 3 packs − ₹60", "Delivery Free", "Total payable ₹1,017".
  - `findClaims(container.textContent)` is `[]`.
  - `useCartView` (via a probe component): a pending slug is excluded from totals and listed in `pending`.
  - `src/styles/css-hygiene.test.ts` passes with the two new files.
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/cart && pnpm exec vitest run --project unit src/styles`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(cart): add the cart line, the summary and the priced cart view`.

### Task K6: The /cart page (PR `feat/cart-page`)

**Files:**
- Create: `src/app/(store)/cart/page.tsx`, `src/components/cart/cart-page.tsx`, `cart-page.test.tsx`, `e2e/cart.spec.ts`.
- Modify:
  - `src/config/routes.ts` (add `checkout: "/checkout"`; `PENDING_ROUTES` drops `"/cart"` and adds `"/checkout"`) and `routes.test.ts`;
  - `e2e/links.spec.ts` (`START` gains `ROUTES.cart`);
  - `docs/dev/architecture.md`, `docs/dev/testing.md` (`cart.spec.ts` row), `CHANGELOG.md`.

**Interfaces:**
- Consumes: K5 components and `useCartView`; `OperateShell`; `EmptyState`; `getCachedProducts()` (for the count only); `SITE_CONFIG.onlinePayments`; `openLogin`; `buttonClass`.
- Produces:
  - `/cart` (static; `metadata = { title: "Your cart", robots: { index: false } }`): `OperateShell` with back `{ href: ROUTES.medicines, label: "Continue shopping" }`, title "Your cart" and sub "Each pack is its printed MRP less ₹20. Delivery is free across India.", then `<CartPage medicineCount={n} onlinePayments={SITE_CONFIG.onlinePayments}/>`.
  - `CartPage` (client), the prototype `.cart-grid`:
    - the Rx group (`section[aria-labelledby=g-rx]`, `.group-head`, "Prescription medicines" with a count "N medicine(s)", and the copy "A pharmacist checks your prescription before we pack. At checkout you can upload one, or choose one you’ve uploaded before.");
    - the non-Rx group (ruling copy, only when non-empty);
    - the `.cart-limit` note at 20 packs: "You’ve reached 20 packs, the most one order can hold. Place this order, then start another.";
    - the aside receipt: "Order summary", the packs count, `CartSummary full`, then the Checkout link (`ROUTES.checkout` signed in; otherwise `/login?next=/checkout`, whose plain click calls `openLogin("/checkout")`), then the receipt note per the ruling;
    - the `.dock` (≤ 720 px), shown while the receipt's Checkout is out of view through an IntersectionObserver, `inert` while hidden;
    - empty: `EmptyState count="0"`, "Your cart is empty", "Find your medicine by brand or salt, then add it here. Every pack is its printed MRP less ₹20." and the action "Browse all <countWord(n)> medicines" → `ROUTES.medicines`;
    - before the first priced view, a loading state with `aria-busy="true"` and no totals.

- [ ] **Step 1: Write the failing tests**
  - `cart-page.test.tsx`:
    - with lines (store mocked): one Rx group with 2 lines; the summary present; Checkout `href="/checkout"` when signed in, `/login?next=%2Fcheckout` (or the exact `sanitizeNext`-compatible form) when a guest;
    - with `onlinePayments=false` the text contains "cash on delivery" and neither "UPI" nor "refund";
    - at 20 packs the limit note shows;
    - empty: "Your cart is empty" and "Browse all eleven medicines" for `medicineCount 11` (`countWord`);
    - `findClaims(text)` is `[]`.
  - `routes.test.ts`: `PENDING_ROUTES` contains `/checkout` and not `/cart`.
  - `e2e/cart.spec.ts` (each run uses a fresh email and its own `x-real-ip`):
    1. As a guest on `/product/sacuwin-100`, Add, then + (2 packs). `/cart` shows "Total payable ₹774", and the Rx group heading is visible.
    2. Sign in by email through `/login?next=/cart` (code from `/dev/outbox`). Back on `/cart`, still 2 packs (merged). A same-origin `fetch("/api/cart")` returns `lines[0].qty === 2`.
    3. Reload → 2 packs. Remove → the empty state.
    4. At 390 px the dock shows when the receipt is scrolled out of view.
    5. `collectConsoleErrors` is empty.
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/cart/cart-page.test.tsx && pnpm exec vitest run --project unit src/config`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS) and the full local check, including `e2e/cart.spec.ts` and `e2e/links.spec.ts`. **Visual:** `node scripts/shoot.mjs http://localhost:3321/cart .impeccable/review/cart 1440,390` against `design/prototype/pages/cart.html` (with lines and empty). Expect the grid, receipt and group head to match the prototype, without the prototype notes. List mismatches in the PR body.
- [ ] **Step 5: Commit** `feat(cart): add the /cart page and route checkout through the pending map`.

### Task K7: Cart drawer (PR `feat/cart-drawer`)

**Files:**
- Create: `src/components/cart/cart-drawer.tsx`, `load-cart-drawer.ts`, `cart-drawer.test.tsx`.
- Modify: `src/components/cart/cart-pill.tsx`, `e2e/cart.spec.ts`, `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: `Overlay variant="side"` (with `returnFocusTo` the pill), `CartLineItem variant="compact"`, `CartSummary kind="mini"`, `useCartView`.
- Produces:
  - `CartDrawer({ open, onOpenChange, returnFocusTo })` (dynamically imported on the first open, like the login dialog). The title is "Your cart" with a `count` of "N packs". The body holds `ul.lines.lines--compact` lines and the mini summary. The footer has "View cart" (`ROUTES.cart`) and "Checkout" (the K6 rule). Empty: `EmptyState` compact with "Your cart is empty" and "Browse medicines".
  - `CartPill`: a plain primary click prevents the default and opens the drawer; a meta, ctrl, shift or middle click follows `/cart`.

- [ ] **Step 1: Write the failing tests** (`cart-drawer.test.tsx`)
  - Clicking the pill loads the drawer module once (a counted mocked import) and shows `role="dialog"` named "Your cart".
  - A meta-click is not intercepted.
  - Escape returns focus to the pill.
  - A line's + inside the drawer changes the pill count.
  - `e2e/cart.spec.ts` gains a case: at 1440 the drawer opens from the pill with one line; at 390 it is a bottom sheet (the panel's bottom equals the viewport height).
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/cart/cart-drawer.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS) and the full local check; the product-page JS budget still holds, because the drawer is lazy.
- [ ] **Step 5: Commit** `feat(cart): open the cart in a side drawer from the header pill`.

### Task R1: Prescription dates, status transitions and the list view (PR `feat/rx-review-model`)

**Files:**
- Create: `src/server/prescriptions/review.ts`, `review.test.ts`.
- Modify:
  - `src/server/prescriptions/validity.ts` and `validity.test.ts`;
  - `docs/dev/architecture.md` (Server modules row and bullet), AGENTS.md "Prescriptions" (one line naming `istMidnight` and the transitions), `CHANGELOG.md`.

**Interfaces:**
- Produces (`validity.ts`):
  - `istMidnight(ymd: string): Date`: `"YYYY-MM-DD"` → that day's 00:00 IST instant. It throws `RangeError` for a malformed or impossible date (`2027-02-30`).
  - `istDay(at: Date): string`
  - `rxEnd(rx: RxSnapshot): Date | null`: `min(validUntil, rxDate + 6 months)`, or `null` when there is no `rxDate`.
- Produces (`review.ts`; pure, with type-only imports):
  - `RX_STATUSES = ["pending", "approved", "rejected"] as const`; `type RxStatus`.
  - `RX_REJECT_REASONS = ["unreadable", "outdated", "incomplete", "patient_mismatch", "not_prescription", "other"] as const`.
  - `RX_DECLARATION_VERSION = "2026-11-27"`; `RX_DECLARATION_TEXT = "This is a valid prescription from a registered doctor, written for the patient named above."`
  - `type RxReview = { kind: "approved"; by: string; at: Date; doctorName: string; doctorRegNo: string } | { kind: "rejected"; by: string; at: Date; reason: RxRejectReason; note: string | null; revoked: boolean }`.
  - `RxApproveInput = z.strictObject({ doctorName: <the PersonName rule, inlined here and re-pointed to PersonName in R4>, doctorRegNo: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9./ -]+$/), rxDate: YMD, validUntil: YMD.optional() })`, where `YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`.
  - `RxRejectInput = z.strictObject({ reason: z.enum(RX_REJECT_REASONS), note: z.string().trim().min(1).max(500).optional() })`.
  - `reviewRx(rx: { status: RxStatus }, action: { type: "approve"; input: RxApproveInput } | { type: "reject"; input: RxRejectInput }, ctx: { at: Date; by: string })`, which returns either `{ ok: true; from: RxStatus; set: RxReviewSet }` or `{ ok: false; error: "not_pending" | "final" | "rx_date_in_future" | "rx_outdated" | "valid_until_out_of_range" | "invalid_date" }`. The rules:
    - approve only from `pending`;
    - `rxDate` ≤ `istDay(at)`, and `at` < rxDate + 6 months;
    - `validUntil` stored = `istMidnight(day + 1)`, required to be > rxDate and ≤ the cap; absent means the cap;
    - reject from `pending` (`revoked: false`) or `approved` (`revoked: true`; `rxDate` and `validUntil` are kept for the record);
    - from `rejected`, `final`.
  - `type RxListItem = { id: string; patientName: string; kind: "image" | "pdf"; pages: number; uploadedAt: string /* ISO */; status: "under_review" | "approved" | "expired" | "rejected"; validUntilDay: string | null; expiredOnDay: string | null; rejection: { reason: RxRejectReason; note: string | null } | null }`.
  - `type RxReviewSet = { status: RxStatus; review: RxReview; rxDate: Date | null; validUntil: Date | null }` (the `set` in `reviewRx`'s ok result).
  - `type RxViewSource = { _id: { toHexString(): string }; patientName: string; file: { kind: "image" | "pdf"; pages: number }; status: RxStatus; review: RxReview | null; rxDate: Date | null; validUntil: Date | null; createdAt: Date }` (R4's `RxDoc` satisfies it).
  - `rxView(doc: RxViewSource, now: Date): RxListItem`:
    - approved and `isRxValidOn` → `approved`, with `validUntilDay = istDay(rxEnd − 1 ms)`;
    - approved and past the end → `expired`, with `expiredOnDay = istDay(rxEnd)`.

- [ ] **Step 1: Write the failing tests**
  - `validity.test.ts`:
    - `istMidnight("2026-11-12").toISOString() === "2026-11-11T18:30:00.000Z"`;
    - `"2027-02-29"` and `"2026-13-01"` throw;
    - `istDay(new Date("2026-11-11T18:29:59.999Z")) === "2026-11-11"`, and one millisecond later `"2026-11-12"`;
    - every new case also runs under `TZ=America/Los_Angeles` (extend `validity.carries.test.ts`).
  - `review.test.ts`:
    - approve `{ rxDate: "2026-11-12" }` at 2026-11-20 → `validUntil` = `istMidnight("2027-05-12")`;
    - with `validUntil: "2027-01-31"` → `istMidnight("2027-02-01")`;
    - `"2027-05-12"` → `valid_until_out_of_range` (the cap is exclusive);
    - `rxDate` tomorrow (IST) → `rx_date_in_future`;
    - `rxDate` 2026-05-20 at 2026-11-20 → `rx_outdated` (exactly 6 months);
    - approve on an approved Rx → `not_pending`;
    - reject an approved one → `revoked: true`;
    - anything on rejected → `final`.
  - `rxView`: approved Rx dated 2026-11-12 → at 2027-05-11T18:29:59.999Z `approved`, "2027-05-11"; at 2027-05-11T18:30Z `expired`, `expiredOnDay "2027-05-12"`. Pending → `under_review`. Rejected → `rejection.reason`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/prescriptions`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(rx): add IST date helpers, review transitions and the list view`.

### Task R2: Prescription file validation and re-encode (PR `feat/rx-file-check`)

**Files:**
- Create: `src/server/prescriptions/file-check.ts`, `file-check.test.ts`, `tests/helpers/rx-fixtures.ts` (fixtures built in code with sharp and strings; no binaries committed).
- Modify: `docs/dev/architecture.md`, `docs/dev/testing.md` (helper row), `CHANGELOG.md`.

**Interfaces:**
- Produces:
  - Constants: `RX_MAX_BYTES = 8_388_608`, `RX_IMAGE_MAX_SIDE = 3000`, `RX_IMAGE_MIN_SIDE = 400`, `RX_MAX_INPUT_PIXELS = 50_000_000`, `RX_WEBP_QUALITY = 85`, `RX_PDF_MAX_PAGES = 20`.
  - `type RxFileError = "empty" | "too_large" | "unsupported_type" | "corrupt" | "too_small" | "animated" | "too_many_pages" | "encrypted" | "active_content"`.
  - `sniffType(bytes: Uint8Array): "jpeg" | "png" | "webp" | "pdf" | null`. The signatures, all at offset 0:
    - JPEG `FF D8 FF`;
    - PNG `89 50 4E 47 0D 0A 1A 0A`;
    - WebP `RIFF????WEBP`;
    - PDF `%PDF-` + `1.[0-7]` or `2.0`.
  - `scanPdf(bytes: Uint8Array): { ok: true; pages: number } | { ok: false; error: "corrupt" | "too_many_pages" | "encrypted" | "active_content" }`, read as latin1:
    - no `%%EOF` in the last 1024 bytes → `corrupt`;
    - names are decoded for `#xx` escapes before matching, and match only when followed by a delimiter (whitespace, `/`, `[`, `<`, `(`, `>`);
    - `/Encrypt` → `encrypted`;
    - the active-content list from the rulings → `active_content`;
    - pages = count of `/Type\s*/Page` not followed by `s`; 0 → `corrupt`; > 20 → `too_many_pages`.
  - `type CheckedRxFile = { body: Uint8Array; contentType: "image/webp" | "application/pdf"; ext: "webp" | "pdf"; kind: "image" | "pdf"; pages: number; width: number | null; height: number | null; sha256: string }`.
  - `checkRxFile(bytes: Uint8Array): Promise<{ ok: true; file: CheckedRxFile } | { ok: false; error: RxFileError }>`. The order:
    1. empty → `empty`; over the cap → `too_large`;
    2. sniff (any other type → `unsupported_type`; declared type and name are ignored);
    3. for an image: `sharp(bytes, { limitInputPixels: 50_000_000, failOn: "error", pages: 1 })`; metadata (`pages > 1` → `animated`; a sharp failure or a pixel-limit error → `corrupt`); then `.rotate().resize(3000, 3000, { fit: "inside", withoutEnlargement: true }).toColorspace("srgb").webp({ quality: 85 })`; output shortest side < 400 → `too_small`;
    4. for a PDF: `scanPdf`, and the body is unchanged;
    5. `sha256` of the stored body.
  - Fixture builders (`rx-fixtures.ts`): `jpegWithExif()` (sharp `withMetadata({ exif: { IFD0: { Make: "Test" } }, orientation: 6 })`), `png(w, h)`, `animatedWebp()`, `pdf({ pages, extra? })`, `htmlAsJpgName()`, `jpegWithTrailer(payload)`.

- [ ] **Step 1: Write the failing tests** (`file-check.test.ts`, a table plus a few named cases)
  - JPEG 1200 × 1600 with EXIF orientation 6 → ok, `image/webp`; the output's `sharp().metadata()` has no `exif`, `icc` or `xmp`, and width 1600 × height 1200 (rotated).
  - A 4000 × 3000 PNG → longest side 3000.
  - A 300 × 900 PNG → `too_small`.
  - Size boundary: exactly `8_388_608` bytes of a valid PDF padded with a comment line → ok; `8_388_609` → `too_large`; empty → `empty`.
  - Review Focus 3:
    - HTML bytes, SVG, GIF89a → `unsupported_type`;
    - `jpegWithTrailer("<script>")` → ok, and the output bytes do not contain `<script>`;
    - a 20,000 × 20,000 PNG header (generated, highly compressible) → `corrupt`;
    - `animatedWebp()` → `animated`;
    - `pdf({ extra: "/OpenAction << /S /J#53 (app.alert(1)) >>" })` → `active_content`;
    - `pdf({ extra: "/Encrypt 5 0 R" })` → `encrypted`;
    - `pdf({ pages: 21 })` → `too_many_pages`;
    - a PDF without `%%EOF` → `corrupt`;
    - a 2-page PDF → ok with `pages: 2` and byte-identical body.
  - `sha256` is the 64-char hex of the output body.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/prescriptions/file-check.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(rx): validate and re-encode prescription files`.

### Task R3: Private file storage providers (PR `feat/rx-storage-providers`)

**Files:**
- Create: `src/server/providers/local-files.ts`, `blob-files.ts`, `local-files.test.ts`, `blob-files.test.ts`.
- Modify:
  - `src/server/providers/types.ts`, `memory-files.ts`, `src/server/env.ts`, `src/server/deps.ts`, `deps.test.ts`, `env.test.ts`;
  - `package.json` and the lockfile (`@vercel/blob`, latest 2.x at implementation; check `scripts/deps-policy.test.ts` allows it);
  - `.env.example`, `.gitignore` (`.data/`);
  - `docs/dev/setup.md` (the `FILE_STORE=local` line), `docs/dev/deploy.md` (Blob store per scope, Mumbai region, `BLOB_READ_WRITE_TOKEN`), `docs/decisions/environments.md`, `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Produces:
  - `FileStore` gains `readonly kind: "memory" | "local" | "blob"`, and `get(path, opts?: { maxBytes?: number })`, which returns `null` for a missing file and throws `FileTooLargeError` (name `FileTooLargeError`) over `maxBytes`.
  - `assertSafeKey(key: string): void`: the key must match `/^[a-z-]+(\/[A-Za-z0-9_-]+)+(\.(webp|pdf))?$/`, else it throws (no `..`, no leading `/`). All three providers call it.
  - `createLocalFiles(dir: string): FileStore`: writes `<dir>/<key>` with `mkdir -p`; the content type goes in a `<file>.type` sidecar.
  - `createBlobFiles(opts: { token: string }): FileStore`:
    - `put` → `put(key, Buffer, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: false, token })`;
    - `get` → `get(key, { access: "private", useCache: false, token })`, reading the stream up to `maxBytes`; `null` on a 404;
    - `delete` → `del(key, { token })`. If the SDK's `del` needs the URL, resolve it with `head(key)` first; check the installed version's docs.
  - Env: `FILE_STORE_LOCAL_DIR` (default `.data/files`) and `BLOB_READ_WRITE_TOKEN` (optional; `requireEnv` when `FILE_STORE=blob`).
  - `deps.ts`:
    - `local` and `memory` both count as mocks (refused when `isMockForbidden()`);
    - with `VERCEL_ENV` set, `FILE_STORE` other than `blob` throws "FILE_STORE=<x> does not persist across Vercel functions: use blob";
    - `blob` builds `createBlobFiles`;
    - `local` builds `createLocalFiles(env.FILE_STORE_LOCAL_DIR)`.

- [ ] **Step 1: Write the failing tests**
  - `local-files.test.ts` (in a temp dir): put, get and delete round-trip bytes and content type; `get` of a missing key → `null`; `maxBytes` exceeded → throws `FileTooLargeError`; `assertSafeKey("../x")`, `"/rx/a"` and `"rx/a/../b"` throw.
  - `blob-files.test.ts`, with `vi.mock("@vercel/blob")`: `put` is called with `access: "private"`, `addRandomSuffix: false`, `allowOverwrite: false` and the token; `get` uses `access: "private"` and `useCache: false`; a 404 → `null`; a 9 MB stream with `maxBytes` 8 MiB → throws.
  - `deps.test.ts`:
    - `FILE_STORE=local` with `VERCEL_ENV=preview` → throws the persistence message;
    - `FILE_STORE=memory` with `MONGODB_DB=aarvion_prod` → throws the mock message;
    - `FILE_STORE=blob` without a token → `EnvError` naming `BLOB_READ_WRITE_TOKEN` on first use, never at import;
    - `FILE_STORE=blob` with a token → `getDeps().files.kind === "blob"`.
  - `env.test.ts`: the default `FILE_STORE_LOCAL_DIR` is `.data/files`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/providers src/server/deps.test.ts src/server/env.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the providers and the wiring above.
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit**
  - `build(deps): add @vercel/blob`;
  - `feat(files): add local and private Vercel Blob file stores`.

### Task R4: Prescription records, staging and the upload service (PR `feat/rx-upload-service`)

**Depends on:** R1, R2, R3.

**Files:**
- Create: `src/server/prescriptions/prescriptions.ts`, `upload.ts`, `tests/int/rx-upload.test.ts`.
- Modify:
  - `src/server/auth/login.ts` (extract and export `PersonName`; `SignupInput.name` uses it; refactor commit first);
  - `src/server/prescriptions/review.ts` (`doctorName: PersonName`);
  - `src/server/audit.ts` (`AuditAction` adds `"rx.upload" | "rx.view"`);
  - `src/server/db/register-all.ts` (`"../prescriptions/prescriptions.ts"`);
  - `docs/dev/architecture.md` (Collections rows for `prescriptions` and `rx_staging`, rate-limit keys), `CHANGELOG.md`.

**Interfaces:**
- Consumes: R1 `rxView`, `reviewRx` types and `RX_DECLARATION_VERSION`; R2 `checkRxFile`, `RX_MAX_BYTES` and `RxFileError`; R3 `getDeps().files`; `hitRateLimit`; `appendAudit`.
- Produces:
  - `PRESCRIPTIONS_COLLECTION = "prescriptions"`, with indexes `userId_createdAt_desc` `{ userId: 1, createdAt: -1 }` and `status_createdAt` `{ status: 1, createdAt: 1 }` (the oldest-first queue for phase D).
  - `RX_STAGING_COLLECTION = "rx_staging"`, with index `expiresAt_ttl` `{ expiresAt: 1 }`, `expireAfterSeconds: 0`.
  - `type RxDoc = { _id: ObjectId; userId: ObjectId; patientName: string; declaration: { version: string; at: Date }; file: { key: string; contentType: "image/webp" | "application/pdf"; kind: "image" | "pdf"; pages: number; bytes: number; sha256: string }; status: RxStatus; review: RxReview | null; rxDate: Date | null; validUntil: Date | null; createdAt: Date; updatedAt: Date }`.
  - `type StagingDoc = { _id: string /* base64url of 16 random bytes, 22 chars */; userId: ObjectId; key: string /* rx-staging/<userIdHex>/<_id> */; createdAt: Date; expiresAt: Date /* +15 min */ }`.
  - `createStaging(userId, now)`; `peekStaging(id, userId, now): Promise<StagingDoc | null>`; `takeStaging(id, userId, now): Promise<StagingDoc | null>` (a `findOneAndDelete` of `{ _id, userId, expiresAt: { $gt: now } }`).
  - `insertRx(doc: RxDoc)`; `listRxForUser(userId, limit = 50): Promise<RxDoc[]>` (newest first); `getRxForUser(id: ObjectId, userId: ObjectId): Promise<RxDoc | null>` (ownership in the filter).
  - `applyRxReview(id: ObjectId, from: RxStatus, set: RxReviewSet, now): Promise<boolean>` (conditional on `{ _id, status: from }`; for phase D).
  - `RX_UPLOAD_LIMITS = { user: { limit: 10, windowMs: 3_600_000 }, ip: { limit: 30, windowMs: 3_600_000 } }`, on keys `rx-upload:user:<id>` and `rx-upload:ip:<bucket>`.
  - `RxCreateBody = z.strictObject({ stagingId: z.string().regex(/^[A-Za-z0-9_-]{22}$/), patientName: PersonName, declaration: z.literal(true) })`.
  - `startRxUpload(i: { userId: ObjectId; ipBucket: string; now: Date }): Promise<{ ok: true; stagingId: string; key: string; mode: "client-token" | "direct" } | { ok: false; error: "rate_limited"; retryAfterSec: number }>`. The IP limit is checked before the user limit; `mode` is `"client-token"` iff `files.kind === "blob"`.
  - `finishRxUpload(i: { userId: ObjectId; body: RxCreateBody; now: Date }): Promise<{ ok: true; rx: RxListItem } | { ok: false; error: "upload_expired" | "file_missing" | RxFileError }>`. The order:
    1. `takeStaging` (single use; missing or expired → `upload_expired`);
    2. `files.get(key, { maxBytes: RX_MAX_BYTES })` (`null` → `file_missing`; `FileTooLargeError` → `too_large`);
    3. `checkRxFile`; on failure delete the staged file and return the error;
    4. `files.put("rx/<uid>/<rxId>.<ext>")`;
    5. `insertRx`; if the insert fails, delete the final file and rethrow;
    6. delete the staged file;
    7. `appendAudit({ action: "rx.upload", actor: user, target: { type: "prescription", id }, meta: { kind, pages } })`;
    8. return `rxView`.

- [ ] **Step 1: Write the failing tests** (`tests/int/rx-upload.test.ts`; memory files; fixtures from `rx-fixtures.ts`)
  - Happy path: start, put the JPEG at `key`, then finish → `ok`; the record has `status: "pending"`, `declaration.version: "2026-11-27"` and a `file.key` matching `^rx/[0-9a-f]{24}/[0-9a-f]{24}\.webp$`. The staged key is deleted, the final key exists, and an audit row `rx.upload` has `meta: { kind: "image", pages: 1 }` and no patient name. `JSON.stringify(record)` has no original file name.
  - Single use: a second `finish` with the same `stagingId` → `upload_expired`. A stagingId of another user → `upload_expired`. At +15 min exactly → `upload_expired`.
  - A finish with an HTML file staged → `unsupported_type`; no record and no final file; the staged file is deleted.
  - Nothing staged → `file_missing`.
  - Rate limits: the 11th start for one user within an hour → `rate_limited`; 31 starts from one IP across users → `rate_limited`, with the IP limit checked first (a blocked IP spends no user budget).
  - `getRxForUser(rxId, otherUser)` → `null`.
  - `applyRxReview(id, "pending", set)` → `true`; again → `false`.
  - The indexes `userId_createdAt_desc`, `status_createdAt` and `expiresAt_ttl` exist.
  - A console spy sees no patient name.
  - `SignupInput` tests still pass after the `PersonName` extraction (the unit run).
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/rx-upload.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), `pnpm exec vitest run --project unit src/server/db/register-all.test.ts src/server/audit.test.ts src/server/auth`, then the full local check.
- [ ] **Step 5: Commit**
  - `refactor(auth): export the PersonName rule`;
  - `feat(rx): add prescription records, staging slots and the upload service`.

### Task R5: Prescription API routes and the ownership-checked file handler (PR `feat/rx-api`)

**Files:**
- Create:
  - `src/app/api/prescriptions/route.ts` (GET list, POST finalise), `staging/route.ts` (POST), `staging/[id]/route.ts` (PUT), `blob-token/route.ts` (POST), `[id]/file/route.ts` (GET);
  - `tests/int/rx-routes.test.ts`.
- Modify:
  - `src/server/http.ts` (export `readCappedBytes(req, max): Promise<Uint8Array>`; `readJson` uses it);
  - `tests/helpers/http.ts` (`bytesPut(path, bytes, opts)`);
  - `docs/dev/architecture.md` (a bullet per route), `CHANGELOG.md`.

**Interfaces:**
- Consumes: R4 service and repo; `requireUser` and `sessionRefreshHeaders` (K2; if K2 has not merged, this task adds the helper and K2 drops it); `handleUpload` from `@vercel/blob/client`.
- Produces (every JSON response `no-store`):
  - `POST /api/prescriptions/staging` → 201 `{ stagingId, mode, pathname }` | 401 | 429.
  - `PUT /api/prescriptions/staging/[id]`:
    - 404 when `files.kind === "blob"`, or when the staging slot is not the caller's or is expired;
    - body read with `readCappedBytes(req, RX_MAX_BYTES)` (413 `file_too_large`);
    - an empty body → 400 `invalid_file`;
    - `files.put(key, bytes, "application/octet-stream")` → 204.
  - `POST /api/prescriptions/blob-token`:
    - 404 unless `files.kind === "blob"`;
    - reads the JSON body; `type === "blob.upload-completed"` → `handleUpload` (signature-verified, a no-op callback) → 200;
    - `type === "blob.generate-client-token"` → `assertSameOrigin`, `requireUser`, `peekStaging(clientPayload, user)`, which must have `pathname === staging.key` (else 403 `forbidden`); then `onBeforeGenerateToken` returns `{ allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"], maximumSizeInBytes: RX_MAX_BYTES, addRandomSuffix: false, allowOverwrite: false, validUntil: staging.expiresAt.getTime() }`. Confirm against the installed SDK that client tokens accept `access: "private"`. If they do not, do not build this route: implement the chunked fallback from the rulings instead (`mode: "chunked"`, the parts route, reassembly in `finishRxUpload`, and R6's `uploadRx` sending ≤ 4 MiB parts), with tests for a missing part, an extra part, a part over 4 MiB and a reassembled total over 8 MiB.
  - `POST /api/prescriptions` (`RxCreateBody`) → 201 `{ rx: RxListItem }` | 410 `upload_expired` | 422 `{ error: "invalid_file", reason: RxFileError | "file_missing" }`.
  - `GET /api/prescriptions` → 200 `{ items: RxListItem[] }` | 401.
  - `GET /api/prescriptions/[id]/file`:
    - `requireUser`; rate limit `rx-file:user:<id>` 120 per hour;
    - `id` must be 24 hex characters; `getRxForUser`; any miss → 404 `not_found`, identical for every case;
    - `files.get(key)`;
    - `appendAudit({ action: "rx.view", actor, target })`;
    - the response is the bytes with `Content-Type` as stored, `Content-Length`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox; default-src 'none'; img-src 'self'`, `Content-Disposition: inline; filename="prescription.<ext>"`, `Cross-Origin-Resource-Policy: same-origin` and `Referrer-Policy: no-referrer`.

- [ ] **Step 1: Write the failing tests** (`tests/int/rx-routes.test.ts`)
  - Full flow through the routes: staging (201, `mode: "direct"`) → PUT bytes (204) → POST finalise (201, `rx.status === "under_review"`) → GET list (1 item) → GET file (200, `content-type: image/webp`, the CSP contains `sandbox`, `nosniff`; an audit row `rx.view`).
  - PUT of `RX_MAX_BYTES + 1` bytes → 413. PUT without `Origin` → 403. PUT to another user's staging id → 404.
  - **Review Focus 4:**
    - user B GETs user A's file → 404 `{ error: "not_found" }`;
    - a malformed id `"x"` → 404 with the same body;
    - a deleted record → the same;
    - none of the three writes an audit row;
    - a staff (pharmacist) customer-kind session of another user → 404 (staff file access is phase D).
  - Finalise with `declaration: false` → 400 `invalid_request`; a patient name `"A​"` → 400.
  - Blob-token with `FILE_STORE=memory` → 404. With a stubbed `files.kind = "blob"` and a mocked `@vercel/blob/client`, a `generate-client-token` for a pathname that is not the staging key → 403, and for the right pathname the mock receives `maximumSizeInBytes: 8388608` and `addRandomSuffix: false`.
  - No route logs the patient name (console spy).
  - The `route-config.test.ts` unit guard passes (`await connection()` first in both GETs).
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/rx-routes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(rx): add the prescription upload, list and private file routes`.

  Split seam if the PR is over 400 lines: `blob-token` into its own PR.

### Task R6: Upload client and the prescription upload form (PR `feat/rx-upload-form`)

**Files:**
- Create:
  - `src/components/rx/rx-copy.ts`, `prepare-file.ts`, `prepare-file.test.ts`, `rx-api.ts`, `rx-api.test.ts`, `rx-upload-form.tsx`, `rx-upload-form.test.tsx`;
  - `src/styles/rx.css`: port flows.css 621–651 (`.drop*`, `.file*`, `.rx-doc`, `.rxc`; skip `.opt*`) and 743–752 (`.rx-list`, `.rx-item`, `.rx-title`, `.rx-meta`, `.rx-why`), plus 727–729 (`.tab-head*`).
- Modify: `src/app/globals.css` [C16], `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: R5 routes (types via `import type`); `TextField`, `Checkbox`, `ErrorSummary`, `Button`, `Icon`, `announce`.
- Produces:
  - `RX_COPY` (prototype strings verbatim where they exist; the rest awaiting owner approval):
    - dropTitleFine "Drag your prescription here"; dropTitleCoarse "Add your prescription";
    - dropHint "A clear photo or scan of the whole page. JPG, PNG, WebP or PDF, up to 8 MB.";
    - pick "Choose a file"; camera "Take a photo";
    - patientLabel "Patient’s name"; patientHint "As written on the prescription."; patientRequired "Enter the patient’s name as written on the prescription.";
    - declaration = `RX_DECLARATION_TEXT` (duplicated here and pinned to the server constant by the test); declarationRequired "Confirm the prescription is valid to continue.";
    - fileRequired "Add a photo or PDF of the prescription.";
    - `unsupported(name)` "“<name>” can’t be used. Choose a JPG, PNG, WebP or PDF file."; `tooLarge(name, size)` "“<name>” is <size>. Files can be up to 8 MB; try a smaller photo or a PDF.";
    - submit "Send for review"; sending "Sending…"; cancel "Cancel"; sent "Prescription sent for review.";
    - corrupt "We couldn’t read this file. Try another photo or a PDF."; tooSmall "This photo is too small to read. Take a closer photo of the whole page."; animated "Upload a still photo, not an animation."; tooManyPages "This PDF has more than 20 pages. Upload only the prescription pages."; pdfBlocked (`encrypted`/`active_content`) "This PDF can’t be checked here. Upload a photo, or a PDF without a password.";
    - expired "The upload took too long. Try again."; `rateLimited(t)` "Too many uploads. Try again in <t>."; network = `LOGIN_COPY.network`.
  - `prepareRxFile(file: File): Promise<{ ok: true; blob: Blob; kind: "image" | "pdf" } | { ok: false; message: string }>`:
    - accepts by MIME type (`image/jpeg|png|webp|heic|heif`, `application/pdf`) or by extension;
    - an image over 1,572,864 bytes or with a longest side over 2560 px is drawn with `createImageBitmap` onto a canvas of longest side ≤ 2560 and saved with `toBlob("image/jpeg", 0.85)`;
    - a decode failure sends the original when its type is allowed, else returns `unsupported`;
    - a PDF is sent as is;
    - the result over `8_388_608` → `tooLarge`.
  - `uploadRx(i: { blob: Blob; patientName: string }, opts?: { signal?: AbortSignal }): Promise<{ ok: true; rx: RxListItem } | { ok: false; error: "unauthenticated" | "rate_limited" | "upload_expired" | "network" | RxFileError | "file_missing"; retryAfterSec?: number }>`:
    1. staging;
    2. by mode: `client-token` → `const { upload } = await import("@vercel/blob/client")`, then `upload(pathname, blob, { access: "private", handleUploadUrl: "/api/prescriptions/blob-token", clientPayload: stagingId })`; `direct` → `fetch(PUT)`;
    3. finalise.
  - `listRx(): Promise<{ ok: true; items: RxListItem[] } | { ok: false; error: "unauthenticated" | "network" }>`.
  - `RxUploadForm({ onUploaded(item: RxListItem), onCancel() })` renders `form.form#rx-form`:
    - the drop zone (`.drop`, `is-over` on drag, `is-invalid` on an error, the `.t-fine`/`.t-coarse` titles);
    - hidden inputs `accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"` and a camera input `accept="image/*" capture="environment"`;
    - the file card (thumb via an object URL, revoked on remove and on unmount; "<size> · ready to send"; a remove button that refocuses "Choose a file");
    - the patient `TextField` and the declaration `Checkbox`;
    - submit: one invalid field keeps its own alert; two or three show one focused `ErrorSummary` with `errorAlert={false}`;
    - while sending, the button is busy and the form is `aria-busy`; one submit in flight at a time;
    - a server error maps to the drop-zone error (file errors) or a form-level `.note--bad`;
    - success announces `sent` and calls `onUploaded`.

- [ ] **Step 1: Write the failing tests**
  - `prepare-file.test.ts` (canvas and bitmap stubbed): an `.exe` → `unsupported`; a 9 MB PDF → `tooLarge` with "9.0 MB"; a 3 MB JPEG → re-encoded to `image/jpeg` ≤ 2560 px; a 200 KB PNG at 1000 px is sent unchanged.
  - `rx-api.test.ts` (mocked `fetch` and dynamic import): `direct` mode calls staging → PUT → POST in order; `client-token` mode calls the mocked `upload` with `access: "private"` and `clientPayload === stagingId`; a 422 `{ reason: "too_small" }` → `error: "too_small"`; a 410 → `upload_expired`.
  - `rx-upload-form.test.tsx`:
    - submitting empty → `ErrorSummary` "There are 3 problems", focused, and no field `role="alert"`;
    - only the declaration missing → the checkbox alert, no summary;
    - dropping a `.gif` → the `unsupported` message;
    - a successful upload calls `onUploaded` once and announces "Prescription sent for review.";
    - a double click on submit sends one upload;
    - the DOM has no `[aria-live]`;
    - `RX_COPY.declaration === RX_DECLARATION_TEXT` (a type-only import plus a test-time import of the server constant is allowed in tests).
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/components/rx && pnpm exec vitest run --project ui src/components/rx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(rx): add the prescription upload client and form`.

  Split seam if the PR is over 400 lines: `prepare-file.ts` and `rx-api.ts` with their tests first.

### Task R7: /account/prescriptions (PR `feat/rx-page`)

**Depends on:** R6 and PR #171 (`openLogin`).

**Files:**
- Create: `src/app/(store)/account/prescriptions/page.tsx`, `src/components/rx/rx-list.tsx`, `rx-page.tsx`, `rx-page.test.tsx`, `e2e/prescriptions.spec.ts`.
- Modify:
  - `src/config/routes.ts` (`PENDING_ROUTES` drops `"/account/prescriptions"`; `"/account"` stays for P1) and `routes.test.ts`;
  - `src/components/rx/rx-copy.ts` (`formatIstDay`, `reasons`, list strings);
  - `e2e/links.spec.ts` (`START` gains `ROUTES.uploadRx`);
  - `docs/dev/architecture.md`, `docs/dev/testing.md` (spec row), `docs/handoff.md` (K/R state), `CHANGELOG.md`.

**Interfaces:**
- Consumes: R6; `OperateShell`; `EmptyState`; `openLogin`; `formatPolicyDate`-style date formatting (add `formatIstDay(ymd)` in `rx-copy.ts`: "12 May 2027").
- Produces:
  - `/account/prescriptions` (static; `metadata = { title: "Prescriptions", robots: { index: false } }`): `OperateShell` titled "Prescriptions" with sub "A pharmacist checks each one. Approved prescriptions stay valid for 6 months from their date.", then `<RxPage/>`.
  - `RxPage` (client) states:
    - loading (`aria-busy`);
    - signed out: `EmptyState` titled "Sign in to upload a prescription", with the copy "Your prescriptions are private to your account." and the action "Sign in" (`href="/login?next=%2Faccount%2Fprescriptions"`; a plain click calls `openLogin(ROUTES.uploadRx)`, and `LOGIN_EVENT` reloads the list);
    - signed in: `.tab-head` with h2 "Prescriptions" and a "Upload prescription" button (`aria-expanded`, `aria-controls="rx-form"`) that toggles `RxUploadForm` and moves focus to its heading "New prescription"; then `RxList`;
    - empty list: `EmptyState compact` "No prescriptions yet".
  - `RxList({ items })` renders `ul.rx-list` of `li.rx-item`:
    - `span.rx-doc` "Rx" (aria-hidden), `p.rx-title` = the patient name, and `p.rx-meta` = "Photo · uploaded 12 Nov 2026" or "PDF · 2 pages · uploaded …";
    - the status tag (`StatusTag`): `wait` "Under review"; `ok` "Approved · valid until <day>"; `off` "Expired on <day>"; `bad` "Rejected";
    - `p.rx-why`: under review → "A pharmacist is checking it."; rejected → the reason copy (`RX_COPY.reasons`: unreadable "We couldn’t read the prescription clearly.", outdated "The prescription is more than 6 months old.", incomplete "The doctor’s name, registration number or signature is missing.", patient_mismatch "The patient’s name doesn’t match the prescription.", not_prescription "This file isn’t a prescription.", other "A pharmacist couldn’t approve it."), then the note on its own line when present, then the action "Upload another"; expired → "Upload a newer one to order these medicines again.";
    - a "View" link to `/api/prescriptions/<id>/file` (`target="_blank" rel="noopener"`, with the visually hidden "(opens in a new tab)").

- [ ] **Step 1: Write the failing tests**
  - `rx-page.test.tsx` (mocked `listRx`):
    - 401 → the sign-in panel; clicking Sign in calls the mocked `openLogin("/account/prescriptions")`;
    - items of each status render the exact tag text above ("Approved · valid until 11 May 2027");
    - the toggle sets `aria-expanded="true"` and focuses "New prescription";
    - an upload prepends the item and closes the form;
    - `findClaims(text)` is `[]`.
  - `routes.test.ts`: `/account/prescriptions` is not pending; `/account` is.
  - `e2e/prescriptions.spec.ts` (a fresh email and its own `x-real-ip` per run):
    1. Signed out, `/account/prescriptions` shows "Sign in to upload a prescription".
    2. Sign in by email; back on the page, Upload prescription → `setInputFiles` with a 1200 × 1600 PNG generated by sharp in the test → patient name "Asha Rao" → tick the declaration → Send for review → "Under review" appears with "Asha Rao".
    3. Open "View": the response is 200 `image/webp` and its headers include `x-content-type-options: nosniff`.
    4. A second user's same-origin `fetch` of that file URL → 404.
    5. `setInputFiles` with a `.txt` renamed `.jpg` (text bytes) passes the client check by extension, and the server answers with the `unsupported` copy.
    6. `collectConsoleErrors` is empty.
  - **Preview smoke (manual, PR body):** on the Vercel preview with `FILE_STORE=blob`, upload one photo and one PDF, open each, and confirm the Blob dashboard shows only `rx/…` keys, private.
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/rx/rx-page.test.tsx && pnpm exec vitest run --project unit src/config`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS) and the full local check, including `e2e/prescriptions.spec.ts` and `e2e/links.spec.ts`. **Visual:** `node scripts/shoot.mjs http://localhost:3331/account/prescriptions .impeccable/review/rx 1440,390` against `design/prototype/pages/account.html?state=account-prescriptions`. Expect the panel, drop zone and list items to match, without the tab rail. List mismatches.
- [ ] **Step 5: Commit** `feat(rx): add /account/prescriptions with upload and status list`.

### Task KR8: K and R finish-review gate (PR `fix/kr-finish-review`)

**Files:** whatever the review finds. Also:
- `docs/decisions/phase-kr-ledger.md` (the execution ledger persisted, as for F and CA);
- `docs/decisions/rulings.md` (provisional rulings the owner confirmed or changed);
- `docs/handoff.md`, `CHANGELOG.md`.

- [ ] **Step 1:** A fresh reviewer (most capable model) reads the branch range `<K1 base>..main` for K and R, against this plan and the spec, with Review Focus 1–5 as the checklist. It also checks every `/api/cart/**` and `/api/prescriptions/**` handler for Origin, `no-store`, the refresh header, `await connection()` and error-name-only logging.
- [ ] **Step 2:** VISUAL at 1440 and 390 for `/cart` (filled, at 20 packs, empty), the drawer, and `/account/prescriptions` (signed out, empty, each status, the form with errors), each against the prototype. Run under reduced motion as well.
- [ ] **Step 3:** Fix findings test-first, each in its own commit; keep the PR ≤ 400 lines or split it.
- [ ] **Step 4:** Run the full local check and the manual script: guest add → sign in → merge → reload; upload a photo and a PDF; view each; a second account is refused.
- [ ] **Step 5: Commit** `fix(cart,rx): apply the K and R finish-review fixes`.

## After this plan

- **O (orders):** `placeOrder` reads `readCart` and prices with `getPurchasableBySlugs` + `cartTotals` (never the client); checkout's Prescription step uses `listRxForUser` + `rxView` ("choose a previously uploaded one", valid ones only) and R's upload flow ("upload new"); "reuse the Rx from a past order" reads the order's `rxId`; `/checkout` leaves `PENDING_ROUTES`; the cart empty state gains "Reorder a past order".
- **D (admin):** the Rx queue reads `status_createdAt`, approves and rejects through `reviewRx` + `applyRxReview`, serves staff file reads through a sibling of the R5 file handler with `requireRole(["pharmacist","admin"])` and `rx.view` audit, and moves linked orders (approve → confirmed, reject → on_hold + refund flag).
- **N:** sweep `rx-staging/` blobs older than 1 h in the cron; restore "We’ll text you when it’s done."; Rx-approved and Rx-rejected messages carry the reason **code's** generic copy only, never the staff note.
- **P1:** `/account` with the tab rail wraps `/account/prescriptions`; deletion removes the user's `rx/<userId>/` files and `carts` doc (retention rules decide what must be kept).
- **H:** PDF active content inside compressed streams and retained PDF metadata (a rasterising or sanitising step, or a dispensing-partner rule); Blob data residency confirmed by the owner.
