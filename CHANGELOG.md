# Changelog

All notable changes to the Aarvion storefront are recorded here, newest first.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and the
version in `package.json` follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Every PR adds one line under `[Unreleased]`**, in the right section (Added, Changed,
Deprecated, Removed, Fixed or Security). Write it for the next maintainer, say what changed and
where, and end it with the PR number, for example `(#57)`. If the number is not known yet, add it
in a follow-up commit after `gh pr create`. Group Dependabot bumps into one line per release.
List only sections that have entries.

Release dates are in IST (Asia/Kolkata). Versions are not tagged yet, so the compare links at the
bottom use commit SHAs.

## [Unreleased]

### Added

- Tailwind CSS 4 with the design tokens in `src/app/globals.css` (verbatim from the prototype,
  Prettier-ignored), every test file mapped to one Vitest project, and the `ui` project's React
  and Testing Library setup (#45).
- Merged base styles in `src/styles/base.css`, the `cn()` class helper, and a dependency policy
  test that bans animation, carousel, toast and icon libraries (#46).
- Foil, dome and banner rasters served from `public/foil/` and `public/banners/` with provenance
  sidecars, pinned by `scripts/public-provenance.test.ts` (#48).
- `AGENTS.md`, the operating manual every coding agent reads first, with `CLAUDE.md` importing
  it and a README pointer (#49).
- Developer docs index, local setup (env var table, dev outbox) and architecture pages under
  `docs/dev/` (#50).
- Testing, CI and merge-gate, and catalogue data pages under `docs/dev/` (#52).
- Deploy plan and the planned secret-rotation and failed-deploy runbooks under `docs/dev/` (#53).
- Catalogue runbooks: add a product, change an MRP, swap a Win2Age photo, add a category (#54).
- `docs/handoff.md`, the living state document for whoever takes over (#55).
- This changelog, with 0.1.0 backfilled from the merged PRs #1–#44 (#56).
- Self-hosted Host Grotesk, Geist and Geist Mono subsets with ₹ in `src/fonts/` (built by
  `pnpm fonts:subset`, drift-tested), and the screenshot tool `scripts/shoot.mjs` (#57).
- Banner carousel reducer `src/components/home/carousel.ts` (#58).
- Scroll film progress maths `src/components/film/progress.ts` (#59).
- Shared shelf order in `src/server/catalogue/order.ts` (`compareVariants`, `orderForShelf`), which
  client code may import (#60).
- The approved project plan, committed as `docs/plan/project-plan.md` (#61).
- Inline SVG icon set (`src/components/base/icon.tsx`), the `BrandMark` component and Indian
  rupee formatting (`src/lib/format/rupees.ts`) (#62).
- Banner carousel controller hook `src/components/home/use-carousel.ts`: autoplay, holds and
  reduced motion (#63).
- Scroll film engine `src/components/film/engine.ts` for the ordering act, bento, rails and
  close (#65).
- `scripts/merge-gate.sh`: merges only when all nine checks pass by name, `pr-size` included
  (#66).
- The official Aarvion logo traced to vectors: masters in `assets/brand/official/`, served
  variants in `public/brand/`, app icons and the Open Graph image in `src/app/`, the prototype
  switched to it, and `scripts/brand-assets.test.ts` (#67).
- Logo tracing script `scripts/trace_logo.py`, which regenerates the masters, `public/brand/`
  and the app icons (#70).
- Cached catalogue reads in `src/lib/catalogue/cached.ts` (`'use cache'`, `cacheLife("hours")`,
  tag `catalogue` plus a per-slug tag for valid slugs), `revalidateCatalogue()` (expires at once),
  `assertCatalogue()` and the dev-only `POST /dev/catalogue/revalidate` (#68).
- `percentOff()` (floored, never rounds up) and the base components `RxBadge`, `StatusTag`, `Rupees`,
  `StampPrice` and `PriceInline` in `src/components/base/`, with `src/styles/stamp.css`; the stamp
  hides its tag below 1% and `src/lib/price-source.test.ts` keeps UI code from recomputing prices (#71).
- `Button` and `ButtonLink` in `src/components/base/` (seven variants, three sizes, a busy state that
  drops clicks) with `src/styles/buttons.css` (#74).
- `src/config/site.ts` (`SITE_CONFIG`, `legalValue`, `assertLegalConfigComplete`, the H4 production
  gate hook) and `routes.ts` (`ROUTES`, `PENDING_ROUTES`) (#76).
- `/dev/styleguide` (every base component on one screen) and `src/proxy.ts`, which makes every `/dev/*`
  URL a real HTTP 404 where mocks are forbidden (#75).
- `StoreFooter` and `Brand` in `src/components/shell/` with `src/styles/footer.css`; the root layout
  renders the footer. The payment line shows only cash on delivery until online payments are live
  (a go-live step in `docs/dev/deploy.md`) (#82).
- `TextField` and the ported forms stylesheet (`src/styles/forms.css`, with the shared `.field-box`): 16 px text, visible labels, errors tied by `aria-describedby` and `aria-invalid`, forced-colors focus, 44 px targets, and a styleguide demo (#79).

### Changed

- The root layout sets `metadataBase` from `APP_URL`, so Open Graph and icon URLs no longer
  resolve to localhost; an unset or invalid value falls back to `http://localhost:3000` instead of
  failing the build (#76).
- The root layout reads the live categories for the footer, so **every build now needs a seeded
  database**: seed the Preview DB before this merges into a Vercel-connected repo (#82).
- `.gitattributes` gives CHANGELOG.md git's union merge driver, so parallel PRs that each add
  a line no longer conflict when a branch merges `origin/main` (#73).
- `pnpm pr-size` no longer counts `public/**` (#48) or `assets/fonts/*.txt` (#57).
- Categories use shopper names (Heart care, Diabetes care, Eye care, Respiratory care, Digestive
  care, Bone and joint care, Urinary care), and the seed puts Sacuwin 50, 100 and 200 first in
  Heart care (`sortOrder` 0–2). Existing databases need the README reseed (#51).
- Cache Components is on: every GET handler starts with `await connection()`, route files no
  longer export `dynamic` (`src/server/route-config.test.ts`), and int tests mock `next/server`
  and `next/cache` (#60).
- The CI `build` job seeds Mongo (`aarvion_build`) and `e2e` seeds `aarvion_e2e`; `withErrors`
  rethrows Next's control flow (`unstable_rethrow`); `partialPrefetching` is on (#68).
- `pr-size` is required for every PR, docs included; `docs/decisions/repo.md` lists the nine
  required checks (#52).
- `docs/progress.md` is retired to a pointer at the handoff, the changelog and the decisions
  (#55).
- Font subset script tightened, a test ties the `next/font` weight ranges to the baked axes, and
  `assets/fonts/README.md` documents the font sources, licences and regeneration (#69).

### Removed

- The draft logo redraw (`assets/brand/*.svg` with live Montserrat text), replaced by the
  official logo (#67).

### Fixed

- `ui` tests run under Vitest 5 again: the `next/navigation` mock state moved to
  `tests/helpers/navigation-mocks.ts`, because Vitest 5 rejects exported `vi.hoisted` values
  (#57).
- The banner carousel reducer keeps a user's pause across motion changes and guards bad input
  (#64).
- `buttonClass()` and `ButtonLink` are server-safe again: only `Button` is a client module
  (`button.client.tsx`, re-exported from `button.tsx`). The `/dev/*` 404 also sends no-store and
  noindex headers (#77).

## [0.1.0] - 2026-11-17

The groundwork, Phase F (foundation) and Phase CA (catalogue, auth and order domain, server
side). Covers the merged PRs #1–#44. #12, #24 and #34 were closed without merging (superseded
by fresh branches), and #9 was closed because `@types/node` majors are ignored (the runtime is
Node 24).

### Added

- Product docs (`docs/catalogue.md`, `docs/missing-products.md`), requirements v0.1, seed data
  for the 11 listed products, the 32 source photos and cutouts, draft logo SVGs, round-1 banner
  scenes and `PRODUCT.md` (#1).
- Next.js 16 App Router app (React 19, TypeScript 6.0, pnpm 12, Node 24) with the lazy zod env
  loader `getEnv()` and `GET /api/health` (#2).
- CI workflow (`lint`, `typecheck`, `unit`, `int`, `build`), PR guards (`pr-title`,
  `branch-name`, `pr-size` at 400 changed lines) and Dependabot (#3).
- Cached Mongo client, named index registry applied by `pnpm db:indexes`, the docker-compose
  replica set (`pnpm db:up`, `pnpm db:down`) and a DB ping in `/api/health` (#10).
- Provider container `getDeps()` with mock SMS and email (written to `dev_outbox`), a fake
  payment gateway and an in-memory file store (#11).
- Playwright harness, a smoke test against the production build and the CI `e2e` job (#13).
- Phase C/A/O server plan and the owner-facing rulings log `docs/decisions/rulings.md` (#15).
- Product and category zod schemas and `sellingPricePaise()`: MRP − ₹20 in integer paise, with
  ₹404 as the default MRP (#16).
- Content-hashed product images under `public/products/<slug>/`, generated by
  `pnpm images:sync` with the `data/product-images.json` manifest and a drift test (#17).
- Insert-only catalogue seed `pnpm seed`, which never overwrites existing documents (#19).
- Catalogue queries: visible categories, product list, literal token search (64 characters, no
  regex), product by slug and variant family (#20).
- Mongo fixed-window rate limiter and client IP buckets from `x-real-ip`, IPv6 grouped by /64
  (#21).
- Phone and email identifier normalisation, the `OTP_PEPPER` env var and `requireEnv()` (#22).
- HMAC-hashed single-use OTP challenges: 6 digits, 5-minute expiry, 5 attempts, 30 s resend
  cooldown (#23).
- User find-or-create and DB-backed sessions: customer 30-day sliding, staff 30-minute idle and
  12-hour absolute (#26).
- Route-handler plumbing: `HttpError`, `withErrors`, `jsonResponse`, `readJson` and the
  `assertSameOrigin` CSRF check (#27).
- `POST /api/auth/otp/send` with ordered limits: cooldown, 20/h per IP, 3/10 min per identifier
  (#29).
- `__Host-aarv_sid` session cookie helpers and a fail-closed session kind (#30).
- `POST /api/auth/otp/verify` with find-or-create user, session rotation and a 10-per-24 h
  failure cap (#31).
- `requireUser` and `requireRole` guards, `GET /api/auth/me`, `POST /api/auth/logout` and the
  append-only `audit_logs` writer (#32).
- Guarded `GET /dev/outbox?to=` for reading mock OTPs, and the OTP login e2e against Mongo in CI
  with the Playwright report uploaded on failure (#33).
- Prescription validity on the IST calendar: 6 months, exclusive end, pharmacist valid-until
  capped at that (#35).
- Pure order state machine `transition()` with Rx, payment and AWB guards and a refund effect
  (#36).
- Design system (`DESIGN.md`, `.impeccable/design.json`) and the approved hi-fi prototypes under
  `design/prototype/` (#37).
- Atomic monthly order numbers `AAR-YYMM-NNNNN` (IST month) in the `counters` collection (#39).
- Phase CA execution ledger `docs/decisions/phase-ca-ledger.md` (#41).
- UI phase implementation plan `docs/superpowers/plans/2026-11-17-phase-ui.md` (#42).

### Changed

- CI cancels in-progress runs only for pull requests, uses the cached mongod binary, and
  Dependabot titles pass `pr-title` (#10).
- Server and script unit tests run in Node; a separate `ui` Vitest project runs
  `src/**/*.test.tsx` on happy-dom (#14).
- `pnpm pr-size` no longer counts `docs/superpowers/**` and `docs/decisions/**` (#16).
- `registerIndexes()` requires an explicit index name and rejects a reused name with a different
  spec (#18).
- Order transitions `confirm`, `pack` and `ship` judge the Rx attached to the order at transition
  time only, and `confirmed → on_hold` and `packed → on_hold` exist for a lapsed Rx (#38).
- Rulings log aligned with the transition-time Rx rule and the verify lockout rule (#41).
- Home prototype reworked into the v2 medicine web-store format, with store banners and their
  provenance (#43).
- UI plan revision 2: 44 tasks for the store-format home, with the pre-flight rulings folded in
  (#44).
- Dependabot: `actions/checkout` 4→7, `actions/setup-node` 4→7, `actions/cache` 4→6,
  `pnpm/action-setup` 4→6, `amannn/action-semantic-pull-request` 5→6 (#4, #5, #6, #7, #8).

### Fixed

- Phase F review findings: `pnpm db:indexes` runs under tsx (it could skip indexes silently),
  `/api/health` returns 503 for a missing database or bad env in production, and the merge-gate
  doc lists the right checks (#14).
- Int tests: the in-memory replica set runs with the TTL monitor off, and two flaky OTP asserts
  are pinned (#25).
- Int-test "port already in use" flake: each Vitest worker gets a fixed port block (#40).

### Security

- Mock providers and dev-only routes are refused when `VERCEL_ENV=production`, when a
  production build lacks `ALLOW_MOCKS_IN_PROD_BUILD=1`, or when the database is `aarvion_prod`
  (#11, #13, #33).
- JSON bodies are capped at 16 KB (413), `Content-Type` must be exactly `application/json`, and
  IPv4-mapped IPv6 addresses share their IPv4 bucket (#28).
- Logout revokes the session before writing the audit row (#33).
- Verify lockout griefing closed: only a code mismatch on a live challenge counts toward the
  10-per-24 h cap, verify is limited to 60/h per IP, and a successful login clears the counter
  (#40).

[unreleased]: https://github.com/Harshit2807161/aarvion-website/compare/7352a44...HEAD
[0.1.0]: https://github.com/Harshit2807161/aarvion-website/compare/ad07cac...7352a44
