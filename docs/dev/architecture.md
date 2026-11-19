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
| `src/app/api/auth/otp/verify/route.ts` | `POST /api/auth/otp/verify` (sets the session cookie; 409 `signup_required` for a new identifier without `signup`) |
| `src/app/api/auth/me/route.ts` | `GET /api/auth/me` (re-issues a sliding customer cookie) |
| `src/app/api/auth/session/route.ts` | `GET /api/auth/session` for the header: always 200 `{ user }` or `{ user: null }` (never 401), `no-store`, re-issues a sliding customer cookie |
| `src/app/api/auth/logout/route.ts` | `POST /api/auth/logout` (204, clears the cookie) |
| `src/app/api/products/route.ts` | `GET /api/products?q=&strength=` for the header search: `q` up to 64 characters (400 `query_too_long`), `strength` 1 to 6 digits (400 `invalid_strength`), 60 a minute per IP bucket on `search:ip:<bucket>` (429 `rate_limited` with `Retry-After`), reads `getCachedProducts()` (never the DB), filters with `matchesTokens` and `strengthTokens`, returns at most 20 `SearchResult`s (`src/lib/catalogue/search-result.ts`: `searchProducts` is the pure filter and holds `SEARCH_LIMIT`, `MAX_RESULTS`, `STRENGTH_RE`; a result is slug, name, salt, pack, mrpPaise, pricePaise, image; no composition array, `internalNotes` or `mrpSource`), `no-store`, and logs no query text |
| `src/app/dev/outbox/route.ts` | `GET /dev/outbox?to=` (dev only) |
| `src/app/dev/styleguide/page.tsx` | `/dev/styleguide` (dev only): every button variant, the Rx badge, tags, stamp and inline prices, the OTP field (`otp-demo.tsx`), the toast demo (`toast-demo.tsx`) the dialog / side sheet demo (`?overlay=dialog` or `side` opens one on load; read client-side in `overlay-demo.tsx`, never via page `searchParams`), the foil pockets (`#styleguide-pockets`: every product from `getCachedProducts()` on print-field foil at the rail widths; it needs the seeded database; when the read fails it logs the error name and shows a hint) and the icon grid, for visual review |
| `src/proxy.ts` | answers a real HTTP 404 for every `/dev/*` request wherever `isMockForbidden()` is true, before anything renders |
| `src/app/layout.tsx` | root layout (`lang="en-IN"`, viewport, theme colour, `metadataBase` from `APP_URL`) around every route, with the `Toaster` and the page's one `LiveRegion` (exactly one may exist, so they live only here) |
| `src/app/(store)/` | route group for customer pages (URLs unchanged): `layout.tsx` wraps the page in `withStoreChrome()` (`src/components/shell/store-chrome.tsx`: `SkipLink`, `AnnounceBar`, `StoreHeader` (with `CartPill` in its `cart` slot), `CartReconcile`, `CategoryBar` (live categories), the page, then the `StoreFooter` from the cached live categories), so **every build needs a seeded database**; `page.tsx` is the home: `main#home.home` (`.home`, the one root rule for the home's 1280px `--container-page` and `--space-sec`, is in `src/styles/quick-trust.css`), an sr-only h1, then `HeroBanner`, `QuickActions`, `TrustStrip` and `OrderingSteps`; the other home sections land with the remaining UI Tasks 21–29; `legal/privacy/page.tsx` and `legal/terms/page.tsx` are the privacy policy (`/legal/privacy`) and the terms of use (`/legal/terms`, whose payment section offers only cash on delivery, naming no online method, until `SITE_CONFIG.onlinePayments` is true), each a `LegalPage` whose copy may state only what `docs/requirements.md`, `PRODUCT.md`, the rulings and the code as built support, with unsupplied facts as `Pending` (bump `POLICY_VERSION` when a policy changes in substance); `legal/{returns-cancellation,shipping,prescription-policy,grievance}/page.tsx` and `contact/page.tsx` are `LegalPage` policies and the contact page (prepaid refund wording stays conditional, "If you paid online", until `SITE_CONFIG.onlinePayments` is true; the prescription page states the Schedule H and H1 rule and never says every medicine needs a prescription [C25]; the ₹5,000 COD cap is copy, not config). Admin and staff routes go in a sibling group (for example `(admin)`) with no footer, as do `/dev/*` (their 404s come from the proxy and are bare). The root `src/app/not-found.tsx` (URLs that match no route) sits outside `(store)` but calls `withStoreChrome()` itself, so a shopper who lands on a dead link still gets the search and the footer; `error.tsx` (page errors, client component, `retry` button, logs only the error name and digest) and `global-error.tsx` (its own `<html>`, inline styles) show no chrome. Keep exactly one `<LiveRegion/>`, in the root layout; the Operate *shell* (`OperateShell`) is a page component that customer cart, account and policy pages use inside `(store)` |
| `src/config/` | `site.ts` (`SITE_CONFIG`: legal name, address, and the pending legal facts, all `null` until the owner supplies them; `legalValue()`, `pendingLegalFields()`, and `assertLegalConfigComplete()`, the H4 production gate; `resolveSiteMetadataBase()`) and `routes.ts` (`ROUTES`, the one map of store links, and `PENDING_ROUTES`, the linked pages that must still 404 until built; each page's task deletes its entry) |
| `src/app/globals.css` | Tailwind 4 entry: the design tokens in `@theme`, copied verbatim from the prototype (Prettier-ignored), and the plain custom properties in `:root` (durations, z-layers, `--sticky-top`, the shadcn roles, and the foil material `--foil-body`, `--foil-print`, `--perforation` and `--perf-v` with `/foil/…` URLs into `public/foil/`, defined once here for the pockets, rails and the ordering steps) |
| `src/styles/` | ported prototype CSS imported by `globals.css` (`base.css`: one merged `@layer base` with resets, focus, type and utilities; `buttons.css`: `.btn*`, `.link`, `.spin`; `stamp.css`: `.dm`, `.stamp*`, `.off`, `.price-inline`, `.rx`, `.tag*`; `otp.css`: `.otp*`; `toast.css`: `.toast*`; `overlay.css`: `.sheet-*` dialog, side drawer and phone bottom sheet, as `@keyframes` on Radix `[data-state]`; `forms.css`: `.field`, `.field-box`, `.input`, `.check*`, `.seg*`; `footer.css`: the store footer, `.foot*`; `header.css`: the announcement line and store header, `.announce*`, `.store-head`, `.sh-*`, `--row-h` and `--hdr-h`; `catbar.css`: the category bar and the 880px chip row, `.catbar*`; `shell.css`: the Operate shell, `.band*` and `.work*`; `cart-control.css`: `.cart-ctl`, `.btn-add`, `.stepper`; `pocket.css`: the product card, `.pocket*`, `.blister` (the dome over `dome-floor.webp`, `--bh` 188px) and `.str`; `empty.css`: the empty-state well, `.empty*` and `.well-count`; `steps.css`: the home's ordering act, `.act-steps`, `.step*`, `.perf*`, `.doc*`, `.log*`, `.label*` (static rules only; `.film` rules come with the film wiring); `banner.css`: the home banner carousel, `.hero*`, `.slide*`, `.dot-fill` and `@keyframes dot-run`; `prose.css`: the policy reading column, `.prose*` (62ch, title-size h2, hairlines between sections) and the `.pending` "To be added" chip; `quick-trust.css`: the home quick-action cards and trust strip, `.quick`, `.qa*`, `.trust*`, and the `.home` 1280 width token; all but `base.css` are imported `layer(components)`), with `tokens.test.ts`, `css-hygiene.test.ts`, `overlay.test.ts` (compiles `globals.css` and checks the scrim rule), `shell.test.ts`, `prose.test.ts` and `banner.test.ts` (the autoplay fill equals `AUTOPLAY_MS` and pauses under a hold or the pause) |
| `src/lib/` | `cn.ts` (`clsx` + `tailwind-merge` class helper), `format/rupees.ts` (Indian rupee formatting), `catalogue/banners.ts` (the home banner slides and the banner fallback: `bannerSlides()` keeps a slide only while its packs are live and never lets a Win2Age pack lead), `catalogue/display.ts` (client-safe wording of catalogue data, ported from the prototype's `build.mjs`: `fullComposition`, `actives` (preservatives and salt forms dropped, each strength one non-breaking unit), `packDisplay`, `strengthTokens`, `shortName`, `plural`, `countWord`, `pocketImage` (the cutout, else the first photo), `categoryAnchor` and the `PocketProduct` type; type-only imports from `src/server`), `catalogue/home-model.ts` (client-safe model of the home bento: `homeModel`, `bentoTiles`, `tileList`, `BENTO_LAYOUT`; imports only `catalogue/order` at runtime), `cart/` (the session-only UI cart: `cart.ts` pure rules and limits, `store.ts` `cartStore` over `sessionStorage` key `aarv-cart-ui-v0` with a cached `getSnapshot` and a frozen `{}` server snapshot, `use-cart-lines.ts` the client hook). It holds slugs and quantities only, never prices (those come from the catalogue when rendered), capped at 10 per product and 20 per order. It stands in until the real server cart arrives in phase K, which replaces it. Also `next-url.ts` (`sanitizeNext(raw)`: the `?next=` guard for post-login redirects; returns "/" unless the value is a same-origin path of at most 512 characters with no backslash or control character and not under `/login`, `/api/` or `/dev/`; it checks the resolved output, because dot segments collapse (`/.//x` becomes `//x`), and blocks the prefixes case-insensitively (a malformed percent escape returns "/"); use it for every `next` read from a URL and pass the result straight to `router.replace`/`push`/`redirect`, never decode it) |
| `components.json` | shadcn/ui config; only `dialog` and `input-otp` may be added (UI plan ruling). After `shadcn add`, swap `lucide-react` for `Icon`, import Radix as `@radix-ui/react-dialog`, remove any `lucide-react`, `tw-animate-css` or `cn` package the CLI adds, revert its `globals.css` edits, and put `// @generated shadcn` on line 1 |
| `src/components/ui/dialog.tsx` | the shadcn dialog primitives, restyled for Aarvion (generated, edited) |
| `src/components/ui/input-otp.tsx` | the shadcn `InputOTP` wrapper, trimmed to the one part `OtpField` uses (generated, edited; no `lucide-react`) |
| `src/components/overlay/` | `Overlay` (`variant` `"dialog"` or `"side"`, `title`, `count`, `closeLabel`, `initialFocus`, `returnFocusTo`, `footer`): Radix Dialog supplies the focus trap, Escape, scroll lock and aria-hidden siblings; `Overlay` adds `aria-modal`, returns focus to whatever opened it, or to `returnFocusTo` (Radix only does that for its own Trigger; Safari and Firefox on macOS leave `body` focused after a mouse click, so pass `returnFocusTo` for click-opened overlays) and puts the drag handlers on the sheet head only (never the panel, where a drag would fight the scrolling body). Below 640px it is a bottom sheet (CSS). Also the pure phone bottom-sheet drag thresholds in `drag.ts` (28% of height, or 24px at 0.45px/ms) and `useDragDismiss`, which returns pointer handlers for the sheet head. The panel follows the finger through an inline transform and carries `is-dragging` from the first pointerdown until it closes (that class holds the CSS open animation off; removing it while open would replay the entrance). Only the inline transition is cleared after a snap-back |
| `src/server/` | business logic (below) |
| `tests/int/`, `tests/helpers/` | integration tests and their helpers |
| `e2e/` | Playwright specs |
| `scripts/` | `pr-size.ts`, `merge-gate.sh`, `sync-product-images.ts`, `seed.ts`, `db-indexes.ts`, `subset-fonts.ts`, `shoot.mjs` (screenshots); Python asset tools (`render_foil.py`, `make_cutouts.py`, `composite_store_banners.py`, `build_stage0_docs.py`, …) |
| `data/` | `products.json` (seed source), `product-images.json` (generated), `source/` (Drive analysis) |
| `public/products/` | generated, content-hashed product images |
| `public/foil/`, `public/banners/` | foil, dome and banner rasters copied unchanged from `design/prototype/assets/`, each with a `.json` provenance sidecar (`scripts/public-provenance.test.ts`) |
| `src/components/` | React components, added task by task (today `base/`: the icon set, `BrandMark`, `Button` (the only client module of the button family: `button.client.tsx`, re-exported from `button.tsx`; its busy handler needs a client component), `ButtonLink` and `buttonClass` (server-safe, in `button.tsx` and `button-class.ts`), `RxBadge`, `StatusTag`, `Rupees`, `StampPrice` and `PriceInline`; `form/`: `TextField` (hint and error ids through `aria-describedby`, `aria-invalid`), `Checkbox` (the same for its error) and `Segmented` (native radiogroup with roving tabindex, arrows, Home and End; LTR only; no error wiring) and `OtpField` (one real input drawn as six boxes, with native paste and `beforeinput` listeners so a pasted or autofilled full code replaces a partial value; pass `ariaLabel` when there is no `<label for>`) with `otpDigits`; `overlay/`: `Overlay` (dialog and side sheet), the drag thresholds and `useDragDismiss`; `home/`: the banner carousel reducer and controller hook, `HeroBanner` (server; picks the slides with `bannerSlides()` and renders each one's `getImageProps` picture, the first one shown eager with `fetchPriority="high"`) inside `BannerCarousel` (client; controls first, then the track of server-rendered slides; the hook alone sets each slide's `is-current`, `is-leaving`, `inert` and image `loading`; styles in `src/styles/banner.css`), and `OrderingSteps` (the static "How ordering works" act; its hooks `data-act`, `data-in`, `data-out`, `.step` and `.is-active` are what `film/` reads, so do not rename them; CSS in `src/styles/steps.css`); `film/`: the scroll film's progress maths and engine; `feedback/`: the customer toast (`toast()`, `dismissToast()`, `<Toaster/>`) and the page's single polite live region (`announce()`, `<LiveRegion/>`), both mounted at the end of `<body>` in `src/app/layout.tsx`; `catalogue/`: `Pocket` (the foil pocket, the product card of the rails, category and product pages: `li.pocket#p-<slug>` with the pack under a dome, the name and `RxBadge`, the actives clamped to two lines (three on phones) with the full composition in the title and for AT, the pack line, `StampPrice` and `CartControl`; `heading` sets its level, and `priority` makes its image eager with `fetchPriority="high"`, never a preload [C24]; images are lazy otherwise; no hooks, so it renders on the server or in a client tree; CSS in `src/styles/pocket.css`); `cart/`: `CartControl` (Add to cart that becomes a stepper; changes and limits are spoken only through `#live`; the count is a plain `<span>`, since `<output>` is an implicit live region), `CartPill` (header cart link, count bumps on change) and `CartReconcile` (renders nothing; drops stored lines for slugs the catalogue no longer has, ignores an empty catalogue, and announces once through `#live`), all fed by the store in `src/lib/cart/`; `shell/`: `withStoreChrome` (the shared store chrome), `EmptyState` (dashed well with a dot-matrix count, title, copy and actions), `StoreHeader` (client; `search`, `account` and `cart` slots with static defaults; `is-stuck` shadow from an IntersectionObserver on `[data-announce]`, never a scroll listener), `AnnounceBar` (client; rotates one notice per 5 s at 720px and below unless reduced motion), `CategoryBar` (server; live categories then All medicines; skips anything not live), `SkipLink`, `StoreFooter`, `OperateShell` and `Brand` (`placement` `footer` or `header`); `search/`: the header search parts, not yet mounted (Task 37 wires them): `highlight` (pure, no RegExp) and `useCombobox` (WAI-ARIA 1.2 combobox keys and ids; no live region of its own); `use-product-search.ts` and `suggestion-list.tsx` follow; `auth/`: pure login helpers, no UI yet: `login-machine.ts` (the login state machine over steps id, code, profile and done: `loginReducer`, `initialLoginState`, `identifierOf` (post exactly this); `busy` is a guard, so a busy state ignores every event but results and `tick`, and an idle state ignores results; the UI runs the effects, calling `sendCode` and `verifyCode` while a state is `busy` (a resend is `resendStart`, then `sendCode`); `codeMessage(state, now)` is the code field's message, and `tick` lifts timed locks; when a code or profile state has `sessionCheck` true the UI calls `fetchSession()` and dispatches `sessionChecked`, because a verify that ended in `network` may still have signed in; `nameRefused` is the server refusing the name, `nameInvalid` the client check; it re-exports `login-copy.ts` (`LOGIN_COPY`, the whole login flow's customer copy; `mmss` and `waitText`, which print "a little while" for a missing wait, never NaN; `MAX_TRIES`, `RESEND_SEC` and `CODE_TTL_MS`, client copies pinned to the server's limits by the test; `nameRefused` is the server refusing the name, `nameInvalid` the client check), `phone.ts` (`normMobile` (strips one `+91`, `91` or `0` prefix, never truncates), `formatMobile`, `MOBILE_RE`, `EMAIL_RE`) and `api.ts` (`sendCode`, `verifyCode`, `fetchSession` over `/api/auth/otp/send`, `/api/auth/otp/verify` and `/api/auth/session`; nothing throws, and a transport failure, a 15 s timeout, a non-JSON or unexpected 2xx body or any other unexpected status maps to `network`, except a 400 on send (`invalid_identifier`) and a 400 or 413 on verify when a `signup` was sent (`signup_required`: the server refused the name); `verifyCode` trims the name; `fetchSession` exposes only `{ name }`; `SignupPayload` is pinned both ways to the server's `SignupInput` by a type-only import in `api.test.ts`; name validation stays server-side; nothing logs identifiers, codes or names); `legal/`: `LegalPage` (the Operate shell plus the `.prose` column, opening with "Last updated" from `POLICY_VERSION` via the pure `formatPolicyDate`), `LegalSection`, `Pending` (the "To be added" chip), `Fact` (a `SITE_CONFIG` value, or `Pending` while unset) and `legalMetadata`, for every policy page) |
| `public/brand/` | the official logo variants and app icons served to the site, copied from the masters (usage guide in its README) |
| `src/fonts/` | committed `.woff2` subsets and `index.ts` (`next/font/local`), built by `pnpm fonts:subset` from `assets/fonts/` |
| `assets/` | source photos and cutouts; `brand/official/` (the traced logo masters, made by `scripts/trace_logo.py`); banner scenes; `fonts/` (source TTFs, OFL licences, `SOURCES.json`, README) |
| `design/prototype/` | the approved hi-fi prototype (excluded from ESLint) |

Planned folders (UI plan): more of `src/components/**` and `src/lib/**`. See
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
| `otp_challenges` | `<channel>:<value>` (one live challenge per identifier) | `expiresAt_ttl` | `issueOtpChallenge`, `verifyOtpChallenge`, `checkOtpChallenge` (refunds a matching check's attempt) |
| `users` | ObjectId | `phone_unique`, `email_unique` (both partial) | `findOrCreateUserByIdentifier` (sign-up `name` and `consents` on insert only), `setUserRole`; lookups filter `{ $eq, $type: "string" }` so the partial indexes apply |
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
(429 `too_many_attempts`) → spend an attempt atomically and compare in constant time
(`spendAndCompare`; with `signup` a match flips `consumedAt`, `verifyOtpChallenge`; without it a
match refunds the attempt, `checkOtpChallenge`) → only a mismatch on a live challenge hits the
failure counter → only after a match, without `signup`, look up the user (`findUserByIdentifier`):
an unknown identifier answers 409 `signup_required` with no user, session or audit row, leaving the
code for one later login with `signup`; a known one has the code consumed → find or create the user
(a new one gets `name` and `consents` from `signup`) → revoke any presented session → create a
session → clear the failure counter → audit `auth.login` (a failed counter reset or audit write is
logged by error name and never fails the login). Every code-check failure (unknown, expired,
consumed, exhausted or mismatched code, or a bad identifier) is 400 `invalid_code`, for unknown and
known identifiers alike; the per-IP limit is 429 `rate_limited` and the lockout 429
`too_many_attempts`, both with `Retry-After`. A 409 keeps the code's original 5-minute expiry and
its attempt budget (mismatches before and after it count toward the 5), and a resend replaces the
challenge, so the held code stops working.

**Sign-up consent** (`SignupInput`, strict): `name` (trimmed, 2–80 characters, at least one letter,
and no Unicode control, format or default-ignorable character such as a zero-width space, a bidi
override or a Hangul filler, since names show in staff views and emails; only a zero-width joiner or
non-joiner with a letter or mark on both sides is allowed, for Indic spellings), `adult: true`,
`termsPrivacy: true` and `marketing` (a boolean; the UI leaves it off). A new user stores them as
`name` and `consents = { channel, termsPrivacy: { version, at }, adult: { at }, marketing: {
optedIn, at } }`, where `version` is `CONSENT_VERSION` (`POLICY_VERSION` in `src/config/site.ts`,
today `2026-11-17`) and `channel` is the OTP channel verified. They are written on insert only;
bumping `POLICY_VERSION` does not yet ask existing users again.

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

**Session route:** `GET /api/auth/session` (#107) is the header's auth source: always 200 with
the public user or `null`, `no-store`. Nothing calls it yet.

**Planned:**
- Header auth state is fetched after hydration from `GET /api/auth/session`, so pages stay
  static. Plan Task 43 wires it (the header's `account` slot, `AccountPill`); until then the
  header shows a static Sign in link.
- Product images are content-hashed, so the CDN can cache them forever.

**Client imports (now):** components (`src/components/**`) and the client-safe `src/lib/**`
modules import at runtime from `src/server/**` only the pure `catalogue/pricing.ts`,
`catalogue/search.ts` and `catalogue/order.ts`; anything else from there is a statement-level
`import type` (`src/components/server-imports.test.ts`). The server-only
`src/lib/catalogue/cached.ts` and `errors.ts` are exempt by name, and must never be imported by a
`"use client"` module (the test sees direct imports only); a new server-only `src/lib` file joins
that list.
