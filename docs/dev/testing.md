# Testing

Every PR adds or updates tests in the same PR. Write the failing test first where practical,
watch it fail, then make it pass.

## Projects

Configured in `vitest.config.ts` (Vitest 5) and `playwright.config.ts` (Playwright 1.65).

| Project | Environment | Files | Command |
| --- | --- | --- | --- |
| `unit` | Node | `src/**/*.test.ts`, `scripts/**/*.test.ts` | `pnpm test:unit` |
| `ui` | happy-dom, React plugin, `tests/helpers/ui-setup.ts` | `src/**/*.test.tsx` | `pnpm test:unit` (runs `unit` and `ui`) |
| `int` | Node + in-memory Mongo replica set | `tests/int/**/*.test.ts` | `pnpm test:int` |
| e2e | Chromium against the production build | `e2e/*.spec.ts` | `pnpm test:e2e` |

- **Every test file belongs to exactly one project:** `scripts/vitest-projects.test.ts` globs
  `{src,scripts,tests}/**/*.test.{ts,tsx}` and fails on a file no project (or two) would run. A
  `.ts` test is `unit`, a `.tsx` test is `ui`, and `tests/int/` is `int`.
- `ui` runs with `@vitejs/plugin-react` and `tests/helpers/ui-setup.ts`: jest-dom matchers,
  Testing Library `cleanup` after each test, and a mocked `next/navigation` (`useRouter` spies,
  `usePathname`, `useSearchParams`). Component tests arrive with the UI plan's later tasks.
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
| `otp.ts` | `lastOtpCode(to)`, reading the mock outbox |

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
  failure path).

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
- Planned (UI plan): `e2e/budgets.spec.ts` (LCP, CLS, first-load JS), `freshness.spec.ts`, and
  specs for the home, shell, catalogue, search and login.

## Guard tests (they enforce conventions)

| Test | Fails when |
| --- | --- |
| `src/server/db/register-all.test.ts` | a module calls `registerIndexes` but `register-all.ts` does not import it |
| `src/server/dev-routes.test.ts` | a route or page under `src/app/dev/` does not call `requireDevRoute()` |
| `src/server/deps.test.ts`, `providers/guard.test.ts` | mocks become reachable in a production-like runtime |
| `src/server/runtime.test.ts` | server unit tests run under a browser emulation |
| `scripts/sync-product-images.test.ts` | a photo or `products.json` changed without `pnpm images:sync` |
| `src/server/catalogue/pricing.test.ts` | any listed product's price is not MRP − ₹20 |
| `src/server/auth/cookie.test.ts` | the cookie `Max-Age` drifts from `SESSION_POLICY` |
| `scripts/pr-size.test.ts`, `tests/int/pr-size.test.ts` | the size counter or its excludes change |
| `scripts/vitest-projects.test.ts` | a test file matches no Vitest project, or more than one |
| `src/styles/tokens.test.ts` | `globals.css` drifts from the prototype's `tokens.css` or DESIGN.md colours |

Planned by the UI plan: `scripts/deps-policy.test.ts`
(banned animation, carousel and toast libraries), `src/lib/price-source.test.ts` (no UI price
maths), `src/server/route-config.test.ts`, `src/components/server-imports.test.ts`, and
`tests/helpers/claims.ts` (`findClaims`, no invented claims).

## Last verified

2026-11-18 on macOS, at main `2573ff5` (#45): `pnpm test:unit` 27 files, 567 tests;
`pnpm test:int` 18 files, 139 tests
(Vitest prints a harmless warning that `vitest.config.ts` is ESM loaded as CommonJS). `pnpm
test:e2e` was not run here.
