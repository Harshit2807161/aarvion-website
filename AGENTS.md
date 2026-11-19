# AGENTS.md

The operating manual for every coding agent (and human) working in this repo. Read it fully
before you change anything. It links to the detail rather than repeating it.

## What this is

The online store of Aarvion Pharmaceuticals (New Delhi). Customers in India log in with an OTP,
upload a prescription, and buy Aarvion's own prescription medicines at **MRP − ₹20** with free
delivery; a pharmacist checks every prescription before an order ships. Staff work in an admin
dashboard. Product facts: [PRODUCT.md](PRODUCT.md), [docs/requirements.md](docs/requirements.md).

Where the build stands and what is next: [docs/handoff.md](docs/handoff.md).

## Read first

1. [docs/handoff.md](docs/handoff.md): the living state document: what is merged, what is in
   flight, owner blockers.
2. [docs/dev/README.md](docs/dev/README.md): setup, architecture, testing, CI, data, deploy,
   runbooks.
3. [docs/decisions/rulings.md](docs/decisions/rulings.md): every ruling made for the owner.
4. The active plan under [docs/superpowers/plans/](docs/superpowers/plans/), especially its
   "Global Constraints" section.
5. [DESIGN.md](DESIGN.md) before any UI work.
6. The approved project plan, [docs/plan/project-plan.md](docs/plan/project-plan.md), for the
   phase table and the owner's inputs.

## Stack

| Area              | Choice (version in use)                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Runtime           | Node 24 (`.nvmrc`, `engines >=24`), pnpm 12.10.1 (`packageManager`)                                          |
| App               | Next.js 16.4 App Router, React 19.3, TypeScript 6.0 strict (held below 7)                                    |
| Data              | MongoDB 8 (docker `mongo:8` locally), `mongodb` driver 7.9, zod 4.6                                          |
| Images            | sharp 0.35                                                                                                   |
| Styling           | Tailwind CSS 4.3 (`@tailwindcss/postcss`); design tokens in `src/app/globals.css` `@theme`                   |
| Tests             | Vitest 5.1 (`unit`, `ui`, `int`), Testing Library 16, mongodb-memory-server 11.3, Playwright 1.65 (Chromium) |
| Fonts             | self-hosted subsets through `next/font/local` (`src/fonts/`); never Google Fonts                             |
| Lint and format   | ESLint 9 (`eslint-config-next`), Prettier 3                                                                  |
| Hosting (planned) | Vercel + MongoDB Atlas (Mumbai); see [docs/dev/deploy.md](docs/dev/deploy.md)                                |

Why each was chosen: [docs/decisions/stack.md](docs/decisions/stack.md).

## Repo map

```
src/app/            Next.js routes: api/{health,auth/**}, dev/{outbox,styleguide}, layout, (store)/ route group (customer pages and the footer; admin goes in another group), the home (`page.tsx`, the hero banner so far);
                    globals.css (Tailwind 4 @theme tokens)
src/styles/         ported prototype CSS (base.css, one @layer base; buttons, stamp, forms, overlay, otp and toast.css) and the token and CSS tests
src/lib/            client-safe helpers (cn)
src/config/         site.ts (legal facts, "To be added" until supplied) and routes.ts (ROUTES, PENDING_ROUTES)
src/components/     React components, built task by task by the UI plan (base/, home/, film/, overlay/, form/, feedback/, shell/, legal/ so far)
src/components/ui/  shadcn primitives (generated, then edited; `// @generated shadcn` on line 1); see docs/dev/architecture.md
src/components/overlay/  dialog and side sheet: `Overlay` (dialog and side sheet), the drag thresholds and `useDragDismiss`
src/fonts/          committed font subsets (Host Grotesk, Geist, Geist Mono) for next/font/local
src/server/         framework-free business logic (the only place rules live)
  catalogue/        schema, pricing, categories, seed, search, queries
  auth/             identifier, otp, users, sessions, cookie, login, guards, roles
  security/         rate-limit, client-ip, origin
  orders/           status (state machine), order-number
  prescriptions/    validity (IST, 6 months)
  providers/        mock SMS/email, fake payments, memory files, the production guard
  db/               client, index registry, register-all
  env.ts deps.ts http.ts audit.ts dev-only.ts
tests/int/          integration tests (in-memory Mongo replica set); tests/helpers/ shared helpers
e2e/                Playwright specs (production build)
scripts/            pr-size, merge-gate.sh, sync-product-images, seed, db-indexes (+ Python asset tools)
data/               products.json (seed source), product-images.json (generated), source/
public/products/    generated, content-hashed product images (never edit by hand)
public/foil/, public/banners/  rasters copied unchanged from design/prototype/assets/, with .json
                    provenance sidecars (pinned by scripts/public-provenance.test.ts)
assets/             source photos, cutouts, brand/official/ (logo masters), banner scenes, fonts/
design/prototype/   approved hi-fi prototype (reference, not app code)
docs/               requirements, catalogue, decisions/, superpowers/plans/, dev/, handoff.md
```

Details: [docs/dev/architecture.md](docs/dev/architecture.md).

## Commands

| Command                                       | Does                                                         | Needs                    |
| --------------------------------------------- | ------------------------------------------------------------ | ------------------------ |
| `pnpm install`                                | install dependencies                                         | Node 24, pnpm 12         |
| `pnpm dev`                                    | dev server on :3000                                          | `.env.local`             |
| `pnpm build` / `pnpm start`                   | production build and server                                  |                          |
| `pnpm lint` / `pnpm typecheck`                | ESLint / `tsc --noEmit`                                      |                          |
| `pnpm format`                                 | Prettier, writes files                                       |                          |
| `pnpm test:unit`                              | Vitest `unit` + `ui` projects                                |                          |
| `pnpm test:int`                               | Vitest `int` project                                         | downloads mongod once    |
| `pnpm test:e2e`                               | Playwright against `pnpm build && pnpm start` on :3100       | Mongo (`pnpm db:up`)     |
| `pnpm db:up` / `pnpm db:down`                 | start / stop the local replica set                           | Docker (colima on macOS) |
| `pnpm db:indexes`                             | create missing indexes                                       | `MONGODB_URI`            |
| `pnpm seed`                                   | insert-only catalogue seed                                   | `MONGODB_URI`            |
| `pnpm images:sync`                            | rebuild `public/products/` and `data/product-images.json`    |                          |
| `pnpm fonts:subset`                           | rebuild the `src/fonts/*.woff2` subsets from `assets/fonts/` |                          |
| `node scripts/shoot.mjs <url> <out> [widths]` | screenshots for the UI plan's visual checks                  | Playwright Chromium      |
| `pnpm pr-size origin/main`                    | count changed lines against the 400 cap                      |                          |

The full local check before every push:

```sh
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build
pnpm db:up && MONGODB_DB=aarvion_e2e pnpm db:indexes && pnpm test:e2e   # routes, auth, pages, e2e
```

## Tests

| Project                        | Files                                      | Run it when                  |
| ------------------------------ | ------------------------------------------ | ---------------------------- |
| `unit` (Node)                  | `src/**/*.test.ts`, `scripts/**/*.test.ts` | every change                 |
| `ui` (happy-dom, React)        | `src/**/*.test.tsx`                        | every component change       |
| `int` (Node + in-memory Mongo) | `tests/int/**/*.test.ts`                   | any DB, route or auth change |
| e2e (Playwright)               | `e2e/*.spec.ts`                            | routes, auth, pages, budgets |

Every test file must belong to exactly one project (`scripts/vitest-projects.test.ts` fails
otherwise). How to write each kind: [docs/dev/testing.md](docs/dev/testing.md).

## CI and the merge gate

- `ci.yml`: `lint`, `typecheck`, `unit`, `int`, `build`, `e2e`. `pr-guards.yml`: `pr-title`,
  `branch-name`, `pr-size`.
- **Merge gate:** all nine checks, `lint`, `typecheck`, `unit`, `int`, `build`, `e2e`,
  `pr-title`, `branch-name` and `pr-size`, must each show `pass` by name in `gh pr checks <n>`.
  A missing or pending check blocks. Every PR, docs included, stays at or under 400 changed lines
  (owner, 2026-11-18). `scripts/merge-gate.sh <n>` checks all nine and squash-merges;
  `ALLOW_OVERSIZE=1` is allowed only with a ruling recorded in `docs/decisions/rulings.md`.
  GitHub branch protection on `main` requires the same nine checks and linear history, and
  blocks force pushes and deletion (repo public since 2026-11-19). Details: [docs/dev/ci.md](docs/dev/ci.md).

## Branches, commits and PRs

- Branch from up-to-date `origin/main` as `type/short-desc` (lowercase, digits, hyphens;
  types `feat|fix|chore|ci|test|docs|refactor|perf|build`). Never commit to `main`.
- Conventional Commits: `type(scope): imperative summary` (≤ 72 chars), a blank line, then a
  body that explains why. Small atomic commits; keep refactors, formatting and behaviour changes
  apart.
- **No `Co-Authored-By` trailer and no "Generated with" line**, in commits or PR bodies.
- Keep each PR at or under 400 changed lines (`pnpm pr-size origin/main`), docs included. Over
  the cap, split along commit or file seams into PRs on fresh branches cut from `origin/main`.
  Never drop tests to fit, and never change the guard to pass.
- PR title = a Conventional Commit; body sections What / Why / How tested (with command output)
  / Risks and rollback ([template](.github/pull_request_template.md)).
- PRs are **squash-merged** with `gh pr merge <n> --squash`, without `--delete-branch`.
- **Never force-push, never rewrite pushed history** (`rebase`, `reset --hard`, amending pushed
  commits), never delete remote branches or tags. To bring in `main`, merge it (a merge commit).
- **Ask a human before merging to `main`** unless the owner has authorised you for this work.
  The owner authorised the build controller to merge PRs whose checks are green
  ([project plan](docs/plan/project-plan.md), Context, point 3); implementers never merge their
  own PRs.
- Never change git config, remotes, hooks, repo settings, collaborators, secrets or branch
  protection without asking.

## Business invariants (never break these)

**Prices**

- Selling price = MRP − ₹20, in integer paise, computed only by `sellingPricePaise(mrpPaise)`
  in [src/server/catalogue/pricing.ts](src/server/catalogue/pricing.ts). It is derived at read
  time and never stored. MRP must be at least ₹21 (2100 paise).
- A pack whose MRP is unknown gets ₹404 (`DEFAULT_MRP_PAISE = 40400`, price ₹384), with
  `mrpSource: "default"`.
- % off is floored, never rounded up: use `percentOff(mrpPaise)` in `pricing.ts`, never inline the maths in UI code. No headline, banner, section or
  meta title leads with the ₹20.

**Prescriptions** ([validity.ts](src/server/prescriptions/validity.ts))

- An Rx is valid only when approved and `rxDate ≤ t < min(validUntil, rxDate + 6 months)`.
  Months are calendar months on the IST (Asia/Kolkata) wall clock, the end is exclusive, and
  the day clamps to the month end (31 Aug + 6 months = 28 or 29 Feb).
- `confirm`, `pack` and `ship` judge the Rx **currently attached** to the order at the
  transition time (`ctx.at`) only. Order placement judges it at the order's `createdAt` (O
  phase). `ctx.at` is server time.

**Order state machine** ([status.ts](src/server/orders/status.ts), pure, no DB, no clock)

- Edges: `pending_payment → placed | cancelled`; `placed → confirmed | on_hold | cancelled`;
  `on_hold → confirmed | cancelled`; `confirmed → packed | on_hold | cancelled`;
  `packed → shipped | on_hold`; `shipped → delivered`. `delivered` and `cancelled` are final.
  An unknown status fails closed.
- `ship` needs an AWB and courier; then the Rx is checked; then payment (precedence
  `awb_required → rx_not_valid → payment_required`). `confirm` and `ship` need COD or a paid
  order; `pack` checks the Rx only. `hold` and `cancel` need a 1–500 character reason.
- `hold` or `cancel` on a paid order returns a `refund` effect. When the O phase persists this:
  `hold` is staff-only; the customer may cancel only until packed (enforced by actor in the API);
  `refund_pending` is set in the same write as the hold; refunds are idempotent; each transition
  is a conditional update on `{ _id, status: from }`.
- Order numbers are `AAR-YYMM-NNNNN`: IST month, monthly sequence, at least 5 digits, never
  truncated.

**OTP and sessions** ([src/server/auth/](src/server/auth/))

- OTP: 6 digits from `randomInt`; only an HMAC-SHA256 with `OTP_PEPPER` is stored; 5-minute
  expiry, 5 attempts, single use, 30 s resend cooldown, all enforced in code (the TTL monitor
  is not a security boundary).
- Send order is fixed: validate → resend cooldown (spends no budget) → 20/h per IP → 3/10 min
  per identifier → issue → deliver; a failed delivery deletes the challenge. The answer never
  depends on whether an account exists.
- Verify order is fixed: normalise → 60/h per IP → peek the 10-per-24 h failure cap → verify →
  only a mismatch on a live challenge counts → find or create the user → revoke any presented
  session → new session → clear the failure counter (a failing reset or audit write is logged
  by error name, never fails the login). Every code-check failure (unknown,
  expired, consumed, exhausted or mismatched code, or a bad identifier) is 400 `invalid_code`.
  The per-IP limit is 429 `rate_limited` and the lockout is 429 `too_many_attempts`, both with
  `Retry-After`; clients treat 429 as its own state.
- Client IP comes only from `x-real-ip`; IPv6 is bucketed by /64. Never trust
  `x-forwarded-for`.
- Sessions: a 32-byte random token; only its SHA-256 is stored. Cookie
  `__Host-aarv_sid; Path=/; Secure; HttpOnly; SameSite=Lax`. Customer: 30-day sliding, cookie
  re-issued when the session slides. Staff: no `Max-Age`, 30-minute idle, 12-hour absolute.
- `requireRole` needs a staff-kind session and the role fresh from the DB; a role change revokes
  every session of that user.
- Every mutation calls `assertSameOrigin(req)` inside `withErrors`; auth responses use
  `jsonResponse` (`no-store`); cookies are read from `req.headers`, never `cookies()`.
- Cache Components is on (#60): every GET handler starts with `await connection()` (then
  `requireDevRoute()` under `src/app/dev/`), and route files never export `dynamic`,
  `revalidate` or `fetchCache` (`src/server/route-config.test.ts`).
- Never log or return an OTP code, a session token, a full phone number or email, or
  prescription content. Logs record error names only. The audit log is append-only through
  `appendAudit()` and holds ids and flags only.

**Content**

- No invented claims: no ratings, reviews, customer or order counts, "bestseller", "trending",
  delivery-time promises, certifications or "licensed". No therapeutic or cure claims (Drugs and
  Magic Remedies Act). Facts not yet supplied render "To be added" (`Pending` or `Fact` from
  `src/components/legal/legal-page.tsx`). The legal page tests run `findClaims`
  (`tests/helpers/claims.ts`) over their rendered text and expect `[]`; each page or section task
  adds it to its tests as it lands. It also flags copy saying every medicine needs a prescription
  [C25]; pass `{ allRx: true }` only where the page computes that from catalogue data.
- Shoppers read category names as Heart care, Diabetes care, Eye care, Respiratory care (and
  Digestive care, Bone and joint care, Urinary care), never therapy-area words such as
  Cardiology. `CATEGORY_LIST` holds the shopper names since #51. The seed is insert-only, so an
  existing database keeps old names and product order until it is reseeded the safe way: README
  "Reseeding after the category rename" (`db.categories.deleteMany({})` then `pnpm seed`, then
  per-slug `updateOne` of product `sortOrder`).
- The seed gives Sacuwin 50, 100 and 200 `sortOrder` 0–2, so the Aarvion-printed packs lead
  Heart care (controller ruling, `rulings.md`). Keep new products after them.
- **Win2Age placeholder photos:** only the Sacuwin packs are Aarvion-printed. 7 products show
  packs printed under Win2Age (Aarvion's earlier marketer) and Caftop's pack is unbranded.
  `imageSource` in `data/products.json` marks each; keep it accurate. A Win2Age pack never
  leads a banner, and product pages will caption Win2Age photos (UI plan Task 32). Swap them
  with [the runbook](docs/dev/runbooks/swap-a-product-photo.md).

**Environments**

- Mock providers are never allowed in production. `isMockForbidden()`
  ([guard.ts](src/server/providers/guard.ts)) refuses them when `VERCEL_ENV=production`, when a
  production build lacks `ALLOW_MOCKS_IN_PROD_BUILD=1`, or when the database is `aarvion_prod`.
  Set `ALLOW_MOCKS_IN_PROD_BUILD=1` only for the e2e build and the Vercel Preview scope.
- Production sets `MONGODB_DB=aarvion_prod`. Previews use a separate database.
- Customer chrome (skip link, announcement, header, category bar, footer) is `withStoreChrome()` in
  `src/components/shell/store-chrome.tsx`, used by the `(store)` layout and by the root
  `not-found.tsx`, which sits outside the group. A new page that renders outside `(store)` and
  wants the chrome calls it; never copy the chrome. Keep exactly one `<LiveRegion/>` (root layout).
  Error boundaries use `retry()` (Next 16.3+), and log only `error.name` and `error.digest`.
- `/dev/*` answers a real 404 where mocks are forbidden, decided by `src/proxy.ts` before anything
  renders. Every dev-only route under `src/app/dev/` also calls `requireDevRoute()` before any
  work (right after `await connection()` in a GET), outside `withErrors`.

**Code rules that protect the invariants**

- Money is integer paise. Inputs reach Mongo only as zod-parsed primitives; no user input becomes
  a regex or an operator object. Public catalogue data never includes `internalNotes`.
- New code in `src/server/**` never calls `new Date()` or `Date.now()`: take `now: Date`; routes
  read `getDeps().now()` once per request.
- Writes that can race are single-document atomic operations (`$inc`, conditional updates,
  upserts with one E11000 retry). Never read-then-write.
- Never throw on missing env at import time; `getEnv()` is the only env authority.
- Every index has an explicit `name`; to change one, rename it, never change it in place
  ([docs/decisions/db.md](docs/decisions/db.md)); every module that calls `registerIndexes` is
  imported by `src/server/db/register-all.ts`.

## Secrets

- Never commit secrets. `.env*` is gitignored except `.env.example`, which holds names and safe
  local defaults only. Local values live in `.env.local`; deployed values live in the Vercel
  project's environment variables, per scope.
- Generate `OTP_PEPPER` with `openssl rand -hex 32`. The e2e run uses a random one.
- If you see a key, token, password or connection string with credentials in the working tree, a
  diff, a log or a PR, stop and flag it. Rotation: [runbook](docs/dev/runbooks/rotate-a-secret.md).

## Design truth

- [DESIGN.md](DESIGN.md) and `.impeccable/design.json`: tokens, type, components, Do's and
  Don'ts. They win over any other description of the look.
- Tokens: `src/app/globals.css` carries `design/prototype/css/tokens.css` verbatim in `@theme`
  (fonts excepted); `src/styles/tokens.test.ts` keeps it in step with the prototype and
  DESIGN.md. It is Prettier-ignored so values stay byte-identical: never reformat it.
- [design/prototype/](design/prototype/): the approved hi-fi prototype (store v2, approved by the
  owner on 2026-11-18). The app ports its CSS class names; diff against it.
- Logo: the official logo is served from `public/brand/` (usage guide in its README), with
  masters in `assets/brand/official/` and app icons in `src/app/`, all generated by
  `scripts/trace_logo.py`, never hand-edited. Logo colours are brand-only, never UI colours. Do
  not edit `public/brand/` or `design/prototype/assets/brand/` unless your task says so.
- UI tasks follow the visual check and finish-review gates in the UI plan.
- Spoken feedback goes through the one polite live region: call `announce()` from
  `src/components/feedback/live-region.tsx`; never add another `aria-live="polite"` element.
  The one exception is the banner carousel's track (DESIGN.md: `off` while rotating, `polite`
  otherwise, from `liveMode()`).
  Customer toasts are `toast()` from `feedback/toast.tsx` (one at a time); Sonner and
  lucide-react are banned. shadcn CLI output (`src/components/ui/`) is committed with a first-line
  `// @generated shadcn` marker and must not bring `lucide-react` or `tw-animate-css` with it.

## Decisions

- Rulings made for the owner: [docs/decisions/rulings.md](docs/decisions/rulings.md). Topic
  records: `stack.md`, `db.md`, `environments.md`, `repo.md`. Phase ledgers:
  `phase-f-ledger.md`, `phase-ca-ledger.md`. At the end of each phase its execution ledger is
  persisted to `docs/decisions/` the same way.
- To record a decision, add one bullet to the right section of `rulings.md`: **the ruling (date)**,
  the reason, and "Cost if wrong: …". If it replaces an older ruling, say "supersedes …" and edit
  the old line to point at the new one. Never delete history.
- Do not reverse a ruling silently. If a task conflicts with one, stop and ask.

## Definition of done

A change is done only when all of these hold:

1. Tests added or updated, written first where practical, and the full local check passes.
2. A line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md), ending with the PR number.
   When merging `origin/main` conflicts on CHANGELOG.md, keep every line from both sides once,
   under the right heading; never re-add an older wording of a line that main has changed.
3. The matching page under [docs/dev/](docs/dev/README.md) is updated for any new or changed
   command, script, env var, route, data rule, folder, convention or procedure; AGENTS.md too if
   it changes how agents work; a ruling recorded if a rule changed.
4. The PR body has What / Why / How tested (command output) / Risks and rollback.
5. `pnpm pr-size origin/main` is at or under 400, or the PR is split.
6. CI is green by name (the merge gate above), with no secrets in the diff.

## Do not

- Do not store, hard-code or recompute a price outside `sellingPricePaise()`; never write
  `- 2000` in UI code.
- Do not let mocks, `/dev/*` routes or `ALLOW_MOCKS_IN_PROD_BUILD` reach production.
- Do not log codes, tokens, phone numbers, emails or prescription content.
- Do not invent ratings, reviews, counts, badges, certifications or medical claims.
- Do not hand-edit `public/products/` or `data/product-images.json`; run `pnpm images:sync`.
  Files in `public/foil/` and `public/banners/` are copied unchanged from
  `design/prototype/assets/` with their sidecars; `scripts/public-provenance.test.ts` pins them.
- Do not re-run `scripts/build_stage0_docs.py`: it overwrites `data/products.json` and the
  catalogue docs.
- Do not change an existing index in place, or add a collection index without a name.
- Do not trust `x-forwarded-for`, and do not call `cookies()` in route handlers.
- Do not add animation, carousel or toast libraries (framer-motion, swiper, gsap, sonner and the
  rest; `scripts/deps-policy.test.ts` enforces it); motion uses `transform` and `opacity` only.
- Do not force-push, rewrite pushed history, delete branches, or merge without the gate.
- Do not add `Co-Authored-By` or "Generated with" lines.
- Do not skip, weaken or delete a failing test to get green; fix the cause or ask.
