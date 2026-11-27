# Testing

Every PR adds or updates tests in the same PR. Write the failing test first where practical,
watch it fail, then make it pass.

## Projects

Configured in `vitest.config.ts` (Vitest 5) and `playwright.config.ts` (Playwright 1.65).

| Project | Environment | Files | Command |
| --- | --- | --- | --- |
| `unit` | Node | `src/**/*.test.ts`, `scripts/**/*.test.ts` | `pnpm test:unit` |
| `ui` | happy-dom, React plugin, `tests/helpers/ui-setup.ts` | `src/**/*.test.tsx` | `pnpm test:unit` (runs `unit` and `ui`) |
| `int` | Node + in-memory Mongo replica set; `tests/helpers/next-mocks.ts` mocks `connection()` and `next/cache` | `tests/int/**/*.test.ts` | `pnpm test:int` |
| e2e | Chromium against the production build | `e2e/*.spec.ts` | `pnpm test:e2e` |

- **Every test file belongs to exactly one project:** `scripts/vitest-projects.test.ts` globs
  `{src,scripts,tests}/**/*.test.{ts,tsx}` and fails on a file no project (or two) would run. A
  `.ts` test is `unit`, a `.tsx` test is `ui`, and `tests/int/` is `int`.
- `ui` runs with `@vitejs/plugin-react` and `tests/helpers/ui-setup.ts`: jest-dom matchers,
  Testing Library `cleanup`, and a mocked `next/navigation` whose state tests set through
  `tests/helpers/navigation-mocks.ts` (`mockPathname`, `mockSearchParams`, `routerSpies`; plain
  objects, since Vitest 5 rejects exported `vi.hoisted` values). `src/components/ui-project.test.tsx`
  proves the setup works.
- Server unit tests must run in Node, not happy-dom (`src/server/runtime.test.ts` checks this):
  happy-dom swaps in browser `fetch`, `Request`, `Response` and `URL`.

When to run what: `unit` on every change; `int` for anything touching the database, a route,
auth or a script that talks to Mongo; e2e for routes, auth flows, pages and budgets. CI runs all
of them on every PR.

Focused runs:

```sh
pnpm exec vitest run --project unit src/server/catalogue
pnpm exec vitest run --project int tests/int/sessions.test.ts
pnpm exec playwright test e2e/auth.spec.ts
```

## Unit tests

- Put `foo.test.ts` next to `foo.ts` (under `src/`), or next to the script in `scripts/`.
- Keep them pure: pass `now` explicitly; never depend on the wall clock.
- Env: `vi.stubEnv("OTP_PEPPER", "x".repeat(64))` then `resetEnvForTests()`; undo with
  `vi.unstubAllEnvs()` and another `resetEnvForTests()`.
- Providers and clock: `setDepsForTests({ now: () => T, sms: … })`, and `resetDepsForTests()` in
  `afterEach`/`afterAll`. To fail a delivery and keep a fake clock, override `sms` and later set
  it back with `setDepsForTests({ sms: mockSms })` (`resetDepsForTests` also drops the clock).
- Date logic: test the exact boundary (for example exactly 5:00 for an OTP, exactly 6 months for
  an Rx) on both sides. `prescriptions/validity.carries.test.ts` also runs the validity maths
  under a non-UTC `TZ`.

## Integration tests

Each `tests/int/*.test.ts` file starts its own one-member `MongoMemoryReplSet`.

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { ensureIndexes } from "@/server/db/indexes";
import "@/server/db/register-all.ts";            // when the test needs unique or TTL indexes
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

beforeAll(async () => {
  await startMemoryReplSet();                    // sets MONGODB_URI and resets env
  await ensureIndexes(await getDb());
}, 120_000);
afterAll(stopMemoryReplSet);
beforeEach(() => clearCollections("sessions"));
```

Helpers in `tests/helpers/`:

| Helper | Use |
| --- | --- |
| `mongo.ts` | `startMemoryReplSet`, `stopMemoryReplSet`, `clearCollections(...names)` |
| `global-setup.ts` | downloads the mongod binary once before parallel files start |
| `clock.ts` | `installClock(iso)` → `{ now, advance(ms) }`, installed as `deps.now` |
| `http.ts` | `jsonPost(path, body, { origin, ip, cookie, contentType })`, `getReq`, `sessionTokenFrom(res)`, `TEST_ORIGIN` |
| `rx-fixtures.ts` | prescription files built in code: `jpegWithExif`, `png`, `animatedWebp`, `pixelBombPng`, `jpegWithTrailer`, `htmlAsJpgName`, `pdf({ pages, extra, encrypt })`, `padPdf`. The only binaries are the small PDFs in `tests/fixtures/rx/` (about 1 to 2 KB each): `annot-objstm-*` (JavaScript in an annotation inside an object stream, hidden by a trick), `viewer-*` (pdf-lib parses differently from a viewer; `viewer-root-confusion` is the documented residual and is accepted), `25-untyped-leaves-*` and a legitimate `legit-openaction-destination` |
| `session.ts` | `signedIn({ role?, phone? })` → `{ user, cookie }`: a real user (through `findOrCreateUserByIdentifier`) and session, with a staff role set before the session when asked; install the clock first |
| `cart.ts` | `seedGuest({ slug: qty })`: seeds the guest cart key (`aarv-cart-guest-v1`) in sessionStorage in its stored shape, before the cart store first reads it |
| `otp.ts` | `lastOtpCode(to)`, reading the mock outbox |
| `auth.ts` | `DEFAULT_SIGNUP`, the sign-up details every login test sends by default; an existing user ignores them |
| `claims.ts` | `BANNED_CLAIMS`, `RX_UNIVERSAL_CLAIMS` and `findClaims(text, { allRx })`: every invented claim in rendered copy (licences, certifications, positive guarantees (a negated "we do not guarantee" passes), cure claims, ratings, reviews, counts, "bestseller", "trending", therapy-area words), plus copy saying every medicine needs a prescription [C25], skipped only with `allRx: true`, which a page passes only when it computed that from catalogue data. The review patterns are narrow because "Under review" is a real Rx status. It reads only the text given, so check `alt`, `aria-label` and metadata separately. The legal page tests use it now; each page or section task adds it to its tests as it lands |

- Call route handlers directly: `import { POST } from "@/app/api/auth/otp/send/route"` and
  `await POST(jsonPost("/api/auth/otp/send", body))`. Handlers read cookies from `req.headers`
  for this reason.
- Stub `OTP_PEPPER` in `beforeAll` in every file that sends or verifies a code.
- **Ports:** each Vitest worker uses a fixed block, `27100 + (VITEST_POOL_ID − 1) × 10`, below
  every OS ephemeral range; on "port in use" it retries up to 3 times, 200 ports higher. Two int
  runs at the same time share the blocks and fall back through retries, so run one at a time
  locally.
- **The TTL monitor is off** (`ttlMonitorEnabled=false`), so expiry is never deleted for you:
  test it with a fake clock, with the expired document still present.
- `testTimeout` is 30 s and `hookTimeout` 180 s (replica set start-up).
- Scripts are tested by spawning them: `tests/int/db-indexes-script.test.ts` runs
  `pnpm db:indexes`, and `tests/int/seed.test.ts` runs `pnpm seed` (with `SEED_DATA_DIR` for the
  failure path). Spawn with `runPnpm` or `runCommand` (`tests/helpers/run-script.ts`: async,
  kills the process group after a timeout), **never `spawnSync`, `execSync` or `execFileSync`**
  in a file that starts a replica set; `tests/int/run-script.test.ts` fails if one does.
- **Former flake, fixed (#PR):** `db-indexes-script` failed about 36 s into the job
  (`MongoServerSelectionError: Server selection timed out after 3000 ms`, or
  `MongoNetworkTimeoutError: connection 1 to 127.0.0.1:271x0 timed out`) and twice hung the
  `int` job for over an hour (#206, #215; the file never reported). Cause: mongodb-memory-server
  reads mongod's log from a pipe on the worker's event loop. `spawnSync` blocked that loop for
  both script runs, the pipe filled (64 KiB on Linux; one `db:indexes` run makes mongod log 30
  to 40 KiB), mongod blocked on a log write, and the script's server selection timed out, or a
  command sent before the stall waited for a reply forever (no socket timeout). A blocked loop
  also stops Vitest's 30 s test timeout from firing. Reproduced locally: six back-to-back
  `spawnSync` runs gave one hang and five selection timeouts; the same runs through `runPnpm`
  all passed. The job's `timeout-minutes: 15` is the backstop for any future hang.

## End-to-end tests

- `playwright.config.ts` builds and starts the app (`pnpm build && pnpm start`) on port 3100,
  with `MONGODB_DB=aarvion_e2e`, a random `OTP_PEPPER` per run and `ALLOW_MOCKS_IN_PROD_BUILD=1`.
  It reuses a server already on 3100 outside CI.
- It needs Mongo at `MONGODB_URI` (default: the local replica set):
  `pnpm db:up && MONGODB_DB=aarvion_e2e pnpm db:indexes && pnpm test:e2e` (not verified here).
- Write specs in `e2e/`. Send same-origin POSTs from the page (`page.evaluate(() => fetch(…))`)
  so the browser adds `Origin`; give each run a unique email and a random `x-real-ip` so the
  rate limits never collide; read codes from `/dev/outbox`.
- In CI a failed run uploads `playwright-report/` and `test-results/` as the `playwright-report`
  artifact for 7 days.
- `e2e/home.spec.ts` checks the hero banner: it rotates within 7 s with no console or page error
  (`collectConsoleErrors`), holds on hover, answers the keyboard, stays put under reduced motion,
  and is a scroll-snap row at 390px.
- `e2e/film.spec.ts` checks the scroll film: under motion at 1440 `#home` gets `film`, `#how` is
  over 2.9 viewports tall, `?p=3:0.5` activates step 2 and fills the perforation, `?p=4:0.3`
  shows the tiles, `?p=5:1` lands the copy and the logo; under reduced motion there is no `film`
  class, `#how` is under 1.2 viewports and nothing is hidden; scrolling top to bottom in both
  leaves `collectConsoleErrors` empty. `?p=` works only with motion on. With the JS chunks
  blocked (motion on), the tiles, the CTA and the logo are still at full opacity and the three
  ordering cards do not overlap.
  blocked (motion on), the tiles, the CTA and the logo are still at full opacity.
  leaves `collectConsoleErrors` empty. `?p=` works only with motion on.
- `e2e/budgets.spec.ts` holds the home budgets, with helpers in `e2e/helpers/perf.ts`: LCP under
  2.5 s at 390 (Slow 4G, 4x CPU) and 1440 with the LCP element being banner slide 1 (eager, an
  `img` under `banners`); slide 1's image at most 60 kB at 390; no request for slides 2 to 4
  before `load`; CLS under 0.1 at both widths with and without motion; the header logo as the
  only image preload (the `Link` response header) and exactly the three self-hosted fonts, none
  from Google, covering the rupee sign; the banner unchanged after 7 s under reduced motion; with JavaScript off at 390, cards 2 to 4 show a loaded picture. The JS total is the sum of the scripts' encoded body sizes from Resource Timing (never `content-length`, which Next omits when compressing), with a 50 kB floor so a measurement that reads nothing cannot pass. The
  first-load JS on `/` is a ratchet at 175 kB gzipped (about 170 kB today; the original 150 kB target was replaced by the ratchets, 2026-11-27): lower `HOME_JS_BUDGET_BYTES` whenever it shrinks. The product page has its own ratchet at 170 kB (`PRODUCT_JS_BUDGET_BYTES`, 166.5 kB measured); a separate PR that lazy-loads the header search island should lower both.
- `e2e/budgets.spec.ts` also holds the product page budgets at 390: first-load JS (the 170 kB ratchet above, with the same floors), LCP the eager first gallery photo under 2.5 s, the photo served as AVIF, CLS under 0.1.
- `e2e/freshness.spec.ts` [P55] changes `mucohelp`'s (Respiratory care) MRP straight in the `aarvion_e2e` database
  (the admin editor does not exist yet; use it instead once it does), expires the cache through
  the dev-only `POST /dev/catalogue/revalidate`, and expects the product page (after proving it was cached) and the home rails to show the new
  MRP, % off and price, then restores the MRP. It needs Mongo reachable at `MONGODB_URI`, like the server.
- `e2e/anchors.spec.ts` checks that every `#x` or `/#x` link on `/` (skip link, banner, category
  bar, footer, rails, the header search form) and on the 404 page lands on an element, and that
  the ids in `PENDING_ANCHORS` (`src/config/routes.ts`) are still missing and still linked;
  delete an entry when its section is built.

## Guard tests (they enforce conventions)

| Test | Fails when |
| --- | --- |
| `src/server/db/register-all.test.ts` | a module calls `registerIndexes` but `register-all.ts` does not import it |
| `src/components/shell/error-pages.test.tsx` | the 404, `error.tsx` (retry once, no message or stack shown or logged), `global-error.tsx` and `EmptyState` |
| `scripts/e2e-console.test.ts` | `isExpectedNotFound` in `e2e/helpers/console.ts`: only a 404 on the page's own URL or a pending route's `_rsc` prefetch is ignored |
| `src/proxy.test.ts` | `/dev/*` stops answering 404 when mocks are forbidden |
| `src/server/dev-routes.test.ts` | a route or page under `src/app/dev/` does not call `requireDevRoute()` |
| `src/server/deps.test.ts`, `providers/guard.test.ts` | mocks become reachable in a production-like runtime |
| `src/server/runtime.test.ts` | server unit tests run under a browser emulation |
| `scripts/sync-product-images.test.ts` | a photo or `products.json` changed without `pnpm images:sync` |
| `src/server/catalogue/pricing.test.ts` | any listed product's price is not MRP − ₹20 |
| `src/lib/price-source.test.ts` | UI code under `src/app/**` or `src/components/**` reads `pricePaise` or `MRP_DISCOUNT_PAISE` or subtracts 2000 itself |
| `src/components/server-imports.test.ts` | a non-test file under `src/components/**`, or under `src/lib/**` other than the server-only `catalogue/cached.ts` and `catalogue/errors.ts`, imports from `src/server/**` (by `@/server/…` or a relative path) other than `catalogue/pricing`, `catalogue/search` or `catalogue/order` without a statement-level `import type` / `export type` (an inline `import { type X }` does not count); it parses with the TypeScript compiler API and also catches side-effect imports, re-exports, `import()` and `require()` |
| `src/server/auth/cookie.test.ts` | the cookie `Max-Age` drifts from `SESSION_POLICY` |
| `scripts/pr-size.test.ts`, `tests/int/pr-size.test.ts` | the size counter or its excludes change |
| `scripts/vitest-projects.test.ts` | a test file matches no Vitest project, or more than one |
| `src/styles/tokens.test.ts` | `globals.css` drifts from the prototype's `tokens.css` or DESIGN.md colours |
| `src/styles/section-token.test.ts` | `--spacing-section` returns to `@theme` and Tailwind generates an `h-section` height that makes `.h-section` headings 144px tall |
| `scripts/subset-fonts.test.ts` | a font subset loses ASCII, typographic or ₹ glyphs, licence name IDs 13/14, its size budget or its axis range, or drifts from a fresh `pnpm fonts:subset` |
| `scripts/public-provenance.test.ts` | `public/foil/` or `public/banners/` gains or loses a file, a `.json` sidecar is missing or wrong, a raster's pixels differ from its sidecar, or a banner is not 1792 × 588 / 840 × 472, not from `composite_store_banners.py`, or over 120 KB |
| `src/styles/css-hygiene.test.ts` | a selector repeats within one at-rule context, in one `src/styles/*.css` file or across two of them [C12]; only `base.css`'s listed group selectors (`.btn`, `.toast`, `.stamp`, …) may also appear in one other file, and that list must stay exact |
| `src/components/overlay/overlay.test.tsx` | the Overlay: dialog role and aria-modal, focus on open, focus trap, Escape and focus return, scrim click, scroll lock and aria-hidden siblings, variants, and the phone drag through the head |
| `e2e/styleguide.spec.ts` | also: at 390px a short drag or a tap on the overlay head leaves no running animation and the transform at identity |
| `src/components/overlay/use-drag-dismiss.test.tsx` | the drag hook: follows the finger, dismisses over the thresholds, snaps back otherwise, never removes `is-dragging` while open, ignores a second pointer and Close, skips the snap-back transition under reduced motion |
| `e2e/login.spec.ts` | `/login` by email against the seeded server: a new address goes Send → code (read from `/dev/outbox`) → profile → consent → Create → `/` with the `__Host-aarv_sid` cookie; after an API logout the same address signs in again (via Send a new code, past the 30 s cooldown) with no profile step; signed in, `/login?next=//evil.com` and `/.//evil.com` land on `/`; `?state=otp-locked` opens the locked demo where mocks are allowed, and the page is `noindex` with no `/dev/` link; on `/legal/terms` the header Sign in opens the dialog on the mobile field, Escape returns focus to the pill, then a new address signs up in it, the dialog closes, "Signed in as E2E" toasts and the pill reads "Your account"; at 390px the dialog is a bottom sheet (its bottom is the viewport's). Each run uses a fresh address and its own `x-real-ip` |
| `e2e/catalogue.spec.ts` | the product page (`/product/sacuwin-100`) loses its buy box, struck MRP and price, facts or eager LCP photo; the strength switcher stops landing on `/product/sacuwin-50`; `/product/nope` is not a 404 on the first hit or shows more than one `header` or `#q`; a product page loses its title or description; a product page loses its title, description, canonical link or single JSON-LD block; `/robots.txt` or `/sitemap.xml` stop behaving (disallow-all outside production, products listed, no login, dev or api); a home rail pocket name stops linking to its page |
| `e2e/catalogue.spec.ts` (category pages) | `/category/cardiology` (5 Add to cart buttons), `/category/urology` (coming soon), a hidden or unknown category (404 on the first request, one header and one `#q`), the home bento link |
| `e2e/cart.spec.ts` | on `/category/cardiology` Add becomes a stepper (data-qty, `.qty`), `#live` says "Sacuwin 100: 1 in cart" and the header pill reads "Cart, 1 pack"; the quantity survives a client navigation to the product page and a reload with no console errors; a cart already in `sessionStorage` hydrates into the stepper and pill on `/`; the 10-per-product limit is spoken through `#live` (the + is `aria-disabled`, so the click is forced). Extend it when K2 replaces the session cart |
| `e2e/copy.spec.ts` | any `START_PAGES` page (or a 404) has visible text, a title or a meta description that matches a banned claim (`findClaims`, `allRx: true`: licences, ratings, guarantees, counts, "therapy" or a Latin specialty name) |
| `e2e/links.spec.ts` | a same-origin link on `/`, a category page, `/contact`, `/login`, a `/legal/*` page or `/product/sacuwin-100` does not return 200, or a `PENDING_ROUTES` path stops returning 404; add new pages to `START_PAGES` (`e2e/helpers/pages.ts`) as their tasks land (runs in CI against the seeded server) |
| `e2e/search.spec.ts` | the header search stops giving 3 options for "valsartan" on a policy page with Enter landing on `/product/sacuwin-50`; a strength chip stops narrowing; on `/` "mucohelp" stops scrolling its pocket into view and focusing Add to cart; Escape stops closing the list and then clearing the field; the quick-actions card stops focusing the search; the same at 390px |
| `e2e/shell.spec.ts` | an unknown URL stops being a 404 inside the store chrome (announcement bar, header, category bar, footer with four "To be added" legal rows, exactly one `#live`) or logs a console error |
| `e2e/smoke.spec.ts` | the home h1 stops matching /Aarvion/, or `/api/health` is not `{ status: "ok", db: "ok" }` |
| `src/styles/overlay.test.ts` | the compiled `globals.css` carries the overlay rules, the Aarvion scrim (not `bg-black/50`) and the shadcn colour mapping |
| `scripts/deps-policy.test.ts` | a banned animation, carousel, toast or icon library (framer-motion, swiper, gsap, sonner, lucide-react, …) or an unlisted Radix package is added |

`src/server/route-config.test.ts` (#60) fails when a route file exports `dynamic`, `revalidate`
or `fetchCache`, or a GET does not start with `await connection()`.

## Last verified

2026-11-19 on macOS, at main `44a31ee` (#59): `pnpm test:unit` 35 files, 698 tests;
`pnpm test:int` 18 files, 141 tests
(Vitest prints a harmless warning that `vitest.config.ts` is ESM loaded as CommonJS). `pnpm
test:e2e` was not run here.
