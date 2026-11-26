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
- The header search is on every customer page: `withStoreChrome` mounts `HeaderSearch` in the `StoreHeader` `search` slot (404 pages included), with strength chips (50, 100, 200) taken from the `sacuwin` family by `strengthChips` (`src/components/search/strength-chips.ts`; none if the family is gone). Escape on a chip closes the panel and returns focus to `#q`, and `aria-controls` is set only while the listbox exists. `e2e/search.spec.ts` covers valsartan from a policy page to `/product/sacuwin-50`, the strength chip, Escape, the quick-actions card, and the reveal of `#p-mucohelp` (scroll, `is-found`, focus on Add) at 1440 and 390 (#156)
- `HeaderSearch` (`src/components/search/header-search.tsx`, not mounted yet): the header search field with a suggestion panel, strength chips and hint, live results and a count announced through `#live`. Enter or a click reveals the pocket on `/` (scroll, `is-found`, focus on its Add or +), else goes to `/product/<slug>`. Escape closes the list, then clears, and stops propagating while it does. A 429 shows "Too many searches" and is not retried. A `[data-search]` click focuses `#q`. Chip and hint styles in `src/styles/search.css`. Mounting in `withStoreChrome` and the e2e follow (#149)
- Login UI, part A of 3: `LoginFlow` in `src/components/auth/login-flow.tsx` with the id step (Mobile/Email switch, send posting exactly `identifierOf(...)`, the busy Send button, the shield line), the redirect to `sanitizeNext(next)` (undecoded) or `onDone`, and completion on mount for a visitor already signed in; adds `LOGIN_COPY.viaLegend`, the switch's hidden legend from the prototype (awaiting owner approval). Not mounted on a route yet (#151)
- Home rails, part 2 of 2: `src/styles/rails.css` (port of the v2 rails, imported by `globals.css`) and `Rails` mounted in `src/app/(store)/page.tsx` after the Shop by category bento, so `#medicines`, `#heart-care`, `#eye-care` and `#respiratory-care` exist. New e2e: `e2e/freshness.spec.ts` (a changed MRP shows on the rails after `POST /dev/catalogue/revalidate`) and `e2e/anchors.spec.ts` (every in-page link on `/` and the 404 resolves); `PENDING_ANCHORS` in `routes.ts` (now empty, since the FAQ built `#questions` and `#faq-win2age`) lists in-page link targets that must stay missing until their section is built. `e2e/smoke.spec.ts` now asks for the level-1 heading, because the rails' "Looking for another Aarvion medicine?" h3 also matches /Aarvion/ (#148)
- Home "Questions" and closing act (static composition): `Faq` (`src/components/home/faq.tsx`) and `Close` (`close.tsx`), styles in `src/styles/faq-close.css`, mounted in `src/app/(store)/page.tsx` after "How ordering works". `Faq` is `section#questions` with six native `<details>` (no script, no live region); `#faq-returns` and `#faq-win2age` are link targets, so do not rename them. The first answer says "Every medicine here is a prescription medicine" only when `HomeModel.allRx` [C25]; the payment answers name Razorpay and a refund only when `SITE_CONFIG.onlinePayments` is true. `FaqHashOpen` (a small client effect) opens the `<details>` a link's hash names. `Close` is `section#close[data-act="pin"][data-lead]` with the mint swoosh alone (`/brand/aarvion-mark.svg`, 184px) as `img.close-swoosh[data-in="0 .62 io"]` and the copy in `.close-copy[data-in=".56 .84 out"]`; the logo pan-in itself is the film's (Task 28). "Search medicines" uses `SearchCardLink` to focus `#q` (#146)
- Home rails, part 1 of 2: `railPlan()` and `RAIL_RISES` in `src/lib/catalogue/home-model.ts` (a rail per category with two or more medicines, then one shared rail for the single-product categories, titled "Diabetes and respiratory care" or "More medicines") and the `Rails` component (`src/components/home/rails.tsx`: `#medicines`, a `section.rail#<category anchor>` per rail, an empty `span.anchor` per folded category, the "Looking for another Aarvion medicine?" card, every pocket image lazy). Not mounted or styled yet; the CSS, the page mount and the e2e checks follow in part 2 (#142)
- Search combobox parts, part 3 of 3: `SuggestionList` (`src/components/search/suggestion-list.tsx`, `src/styles/search.css`): a listbox of options with a 44 px thumbnail, highlighted name, "salt · pack" and `PriceInline`, in the API's shelf order. No `aria-live` on it; `pointerdown` is prevented so the input keeps focus (#141)
- Search combobox parts, part 2 of 3: `useProductSearch` and `SEARCH_DEBOUNCE_MS` (150 ms) in `src/components/search/use-product-search.ts`. One in-flight request (the previous is aborted), stale responses dropped by sequence id, no request for an empty query without a strength, the query capped at 64 characters through `queryTokens`, strength checked against `STRENGTH_RE`, 429 is `limited` and never retried until the query changes, any other failure or malformed body is `error`, and nothing logs query text (#138)
- Search combobox parts, part 1 of 3 (not wired into the header yet; Task 37 does that), in `src/components/search/`: `highlight` (pure, literal `indexOf`, no RegExp, returns `{ text, mark }` segments to render as `<mark>`) and `useCombobox` (WAI-ARIA 1.2 keys and ids; arrows wrap, Enter takes the active or first item, Escape closes then clears; adds no live region, result counts go through `announce()`). `useProductSearch` and `SuggestionList` follow (#130)

- Login state machine, sign-up and session check: `signup_required` opens the profile step holding the code; `signup_required` after details were sent is a name error (`LOGIN_COPY.nameRefused`), not another sign-up loop; the client name check mirrors the server's hidden-character rule, and a name over 80 characters gets `LOGIN_COPY.nameTooLong` instead of "at least 2 letters"; an expired code in the profile returns to the code step keeping the details; `rate_limited` in the profile sets `lockedUntil`, which blocks Create account until `tick` lifts it; a verify that ends in `network` sets `sessionCheck`, and the UI runs `fetchSession()` and dispatches `sessionChecked` (a session means signed in) before showing an error (#145).
- Login state machine, resend and code step: a `resend_cooldown` on the id step means a live code exists and opens the code step; a resend gets a fresh clock and try budget and lifts only the per-code lock (the daily and network locks belong to the identifier and the IP, which the server keeps), a resend that cannot be delivered returns to the id step with the message (the server deleted the old code), and a resend failure shows even while the code is locked. Wrong codes count down from `MAX_TRIES` (an expired code counts none, the last one locks until a resend), `too_many_attempts` locks for the day and `rate_limited` blocks Verify for the network wait without spending a try; `tick` lifts timed locks and `codeMessage(state, now)` is the code field's message. Sign-up and network outcomes follow (#145).
- Login state machine, resend and code step: a `resend_cooldown` on the id step means a live code exists and opens the code step; a resend gets a fresh clock and try budget and lifts only the per-code lock (the daily and network locks belong to the identifier and the IP, which the server keeps, so a resend is refused while one holds and its message stays; a rate-limited resend moves the resend countdown and shows no fixed text), a resend that cannot be delivered returns to the id step with the message (the server deleted the old code), and a resend failure shows even while the code is locked. Wrong codes count down from `MAX_TRIES` (an expired code counts none, the last one locks until a resend), `too_many_attempts` locks for the day and `rate_limited` blocks Verify for the network wait without spending a try; `tick` lifts timed locks and `codeMessage(state, now)` is the code field's message. Sign-up and network outcomes follow (#145).
- Login state machine, id and send steps (pure, no UI yet): `src/components/auth/login-machine.ts` (`loginReducer`, `initialLoginState`, `identifierOf`, the full `LoginState` and `LoginEvent` types). It validates the mobile number or email, moves to the code step on `sendOk`, maps send failures to copy. `busy` is a real guard: while busy it ignores input, channel and submit, and it ignores any result when idle. Post exactly `identifierOf(channel, raw)`. Resend, verify and sign-up follow in later PRs (#145).
- Login state machine, resend and code step: a `resend_cooldown` on the id step means a live code exists and opens the code step; a resend gets a fresh clock and try budget and lifts only the per-code lock (the daily and network locks belong to the identifier and the IP, which the server keeps, so a resend is refused while one holds and its message stays; a rate-limited resend moves the resend countdown and shows no fixed text), a resend that cannot be delivered returns to the id step with the message (the server deleted the old code), and a resend failure shows even while the code is locked. Wrong codes count down from `MAX_TRIES` (an expired code counts none, the last one locks until a resend), `too_many_attempts` locks for the day and `rate_limited` blocks Verify for the network wait without spending a try; `tick` lifts timed locks and `codeMessage(state, now)` is the code field's message. Sign-up and network outcomes follow (#143).
- Login state machine, id and send steps (pure, no UI yet): `src/components/auth/login-machine.ts` (`loginReducer`, `initialLoginState`, `identifierOf`, the full `LoginState` and `LoginEvent` types). It validates the mobile number or email, moves to the code step on `sendOk`, maps send failures to copy. `busy` is a real guard: while busy it ignores input, channel and submit, and it ignores any result when idle. Post exactly `identifierOf(channel, raw)`. Resend, verify and sign-up follow in later PRs (#143).
- Home bento model (`src/lib/catalogue/home-model.ts`, pure and client-safe): `homeModel` (live categories with products in shelf order, coming-soon categories, `total`, `allRx`), `bentoTiles` (tile order follows `BENTO_LAYOUT`'s keys, then any other live category as a plain `tile-diab` cell with no art), `tileList` (brand names in shelf order, strength families collapsed: "Sacuwin 50, 100 and 200") and `BENTO_LAYOUT` (each category's grid cell and art slugs). Unused until the bento component lands in the next PR (#127).
- Login state machine, id and send steps (pure, no UI yet): `src/components/auth/login-machine.ts` (`loginReducer`, `initialLoginState`, `identifierOf`, the full `LoginState` and `LoginEvent` types). It validates the mobile number or email, moves to the code step on `sendOk`, maps send failures to copy. `busy` is a real guard: while busy it ignores input, channel and submit, and it ignores any result when idle. Post exactly `identifierOf(channel, raw)`. Resend, verify and sign-up follow in later PRs (#137).
- Home "Shop by category" bento (static composition): `CategoryBento` (`src/components/home/category-bento.tsx`, `src/styles/bento.css`), mounted in `src/app/(store)/page.tsx` between the trust strip and "How ordering works". Four links to `/category/<slug>` (Heart care, Eye care, Diabetes care, Respiratory care) over product cutouts, counts and lists from the catalogue, and a dashed "Coming soon" tile; it carries the `data-act="pass"` and `data-in` hooks the film engine reads. The home page is now async. `.tile-cardio` leaves `base.css`'s dark-ground `--focus` list so the selector appears once across `src/styles` [C12]; its focus ring is the default forest one, on white (#139).
- Home bento model (`src/lib/catalogue/home-model.ts`, pure and client-safe): `homeModel` (live categories with products in shelf order, coming-soon categories, `total`, `allRx`), `bentoTiles` (tile order follows `BENTO_LAYOUT`'s keys, then any other live category as a plain `tile-diab` cell with no art), `tileList` (brand names in shelf order, strength families collapsed: "Sacuwin 50, 100 and 200") and `BENTO_LAYOUT` (each category's grid cell and art slugs). `CategoryBento` renders it on the home page (#127).
- Hero banner on the home page (`src/components/home/banner.tsx`, mounted by `src/app/(store)/page.tsx` in `main#home.home` under an sr-only h1): four rotating slides chosen by `bannerSlides()`, each an art-directed picture through `getImageProps` (the 840 × 472 phone crop below 720px, else the 1792 master) with live copy and a forest button. The first slide shown is the LCP image, eager with `fetchPriority="high"`; the rest load lazily. `e2e/home.spec.ts` covers rotation, hover hold, keyboard, reduced motion and the phone scroll-snap row (#129).
- The foil pocket, the storefront's product card (`src/components/catalogue/pocket.tsx`, `src/styles/pocket.css`, imported by `globals.css`): the pack under a clear dome on print-field foil, the name with its Rx badge, the actives (two lines, three on phones, never cutting a strength), the pack line, the stamp price with its % off and Add to cart. Images are lazy; `priority` gives the LCP candidate `loading="eager"` and `fetchPriority="high"`, never a preload. The foil material variables (`--foil-body`, `--foil-print`, `--perforation`, `--perf-v`) are defined once in `globals.css`'s `:root`, and `--perforation` leaves `.home` in `quick-trust.css`. In `stamp.css` the MRP never breaks and the % off pill wraps under it in a narrow pocket (164px phones); `cart-control.css` (Task 15) gains the 13px phone Add to cart label. The import guard now also checks client-safe `src/lib/**`. `/dev/styleguide` shows every catalogue product as a pocket, and `e2e/styleguide.spec.ts` checks one loads through `next/image` (#122).
- `GET /api/products?q=&strength=`: the header search's data. Reads the cached catalogue, matches by query tokens and variant strength in shelf order, returns at most 20 `SearchResult`s (`src/lib/catalogue/search-result.ts`), `no-store`, 60 requests a minute per IP bucket (429 `rate_limited`), and never logs the query. (#123)
- Banner carousel shell (`src/components/home/banner-carousel.tsx`, client) and its styles (`src/styles/banner.css`, a port of the v2 site.css banner rules, imported by `globals.css` and covered by `css-hygiene.test.ts`): the play/pause, previous, dot and next controls come first in the DOM, the track's `aria-live` follows `liveMode()`, and the root gains `is-ready`, `is-auto`, `is-held`, `is-stopped` or `no-auto` only after mount. The current dot's 6 s `dot-run` fill is the autoplay clock and pauses under a hold or the user's pause. The banner takes its 1280px width from the one home root rule (`.home` in `src/styles/quick-trust.css`); it sets no width of its own (#126).
- Login copy (pure, no UI yet): `src/components/auth/login-copy.ts` holds `LOGIN_COPY` (every customer string of the login flow), `mmss`, `waitText` (a missing or non-finite wait reads "a little while", never NaN) and the client constants `MAX_TRIES`, `RESEND_SEC`, `CODE_TTL_MS`, which `login-copy.test.ts` pins to the server's limits. `nameRefused` is the copy for the server refusing the name. The state machine follows in later PRs (#128).
- Home banner slides and the banner fallback (`src/lib/catalogue/banners.ts`): `BANNER_SLIDES` holds the four slides' copy, links, alt text and rasters; `bannerSlides(products)` shows a slide only while every pack it names is live, and without Sacuwin the prescription slide leads, so a Win2Age-printed pack never leads the banner. The delivery line says "Cash on delivery available." until `SITE_CONFIG.onlinePayments` is on (#113).
- Login API client, verify half: `verifyCode` and `fetchSession` in `src/components/auth/api.ts`, plus `SignupPayload`, type-pinned both ways to the server's `SignupInput` in `api.test.ts`. `verifyCode` posts the trimmed name and a `signup` only when passed; a 400 or 413 with a signup is `signup_required` (the server refused the name), a 429 keeps `retryAfterSec`, and every other unexpected status maps to `network`. `fetchSession` returns only `{ name }`, or null when signed out or on any failure. The login state machine shows `nameRefused` on the name field for it in the profile step (#120).
- `src/components/server-imports.test.ts`: components may import at runtime from `src/server/**` only `catalogue/pricing`, `catalogue/search` and `catalogue/order`; anything else needs a statement-level `import type`. It parses each file with the TypeScript compiler API, so side-effect imports, re-exports, `import()` and `require()` are caught too (#118).
- Catalogue display helpers (`src/lib/catalogue/display.ts`), ported from the v2 prototype's `build.mjs` for the pocket, rails, category and product pages: `fullComposition`, `actives` (preservatives and salt forms dropped, each strength one non-breaking unit so a wrap or the line clamp never cuts it), `packDisplay` ("10 ml bottle" for eye drops, a number kept with its unit), `strengthTokens`, `shortName`, `plural`, `countWord`, `pocketImage` (the cutout, else the first photo), `categoryAnchor` and the `PocketProduct` type (#118).
- Login API client, send half: `src/components/auth/api.ts` (`sendCode` and the shared `call` helper). It never throws: a transport failure, a 15 s timeout, a non-JSON or unexpected 2xx body and any other unexpected status map to `network`, except a 400, which is `invalid_identifier`. `verifyCode` and `fetchSession` follow in the next PR. Also `sanitizeNext` now returns "/" on a malformed percent escape instead of skipping the blocked-prefix check (#119).
- Login helpers (pure, no UI yet): `src/components/auth/phone.ts` (`normMobile`, `formatMobile`, `MOBILE_RE`, `EMAIL_RE`) and `src/lib/next-url.ts` (`sanitizeNext` for the `?next=` redirect: same-origin paths only, never `/login`, `/api/` or `/dev/`) (#117).
- `CartReconcile` (`src/components/cart/cart-reconcile.tsx`, mounted by `withStoreChrome()` with the slugs from `getCachedProducts()`) and `cartStore.reconcile`: stored cart lines for products the catalogue no longer sells are dropped so they cannot fill the 20-pack cap, with one polite announcement. An empty catalogue list is ignored, not treated as every product gone (#115).
- Home "How ordering works" static composition: `OrderingSteps` (`src/components/home/ordering-steps.tsx`, `src/styles/steps.css`), mounted in `src/app/(store)/page.tsx`. Three steps over a dashed perforation and three example cards (prescription, order, shipping label) labelled "Example ...". It carries the `data-act`, `data-in` and `data-out` hooks that the film engine reads; the `.film` rules (and any `.film-root.measuring ...` selectors) arrive with the film wiring task. `--space-sec` and `--perforation` are scoped to `.act-steps` until a shared definition lands (#112).
- Terms of use at `/legal/terms` (`src/app/(store)/legal/terms/page.tsx`): who can order, OTP sign-in, the prescription rule and validity ruling, prices, payment and quantity limits, delivery, cancellations and returns, no medical advice, and "To be added" for liability and governing law; the payment section offers only cash on delivery and names no online method until `onlinePayments` is true, then Razorpay as well (#105).
- E2E: `e2e/shell.spec.ts` (an unknown URL is a 404 inside the store chrome) and `collectConsoleErrors(page)` in `e2e/helpers/console.ts`, which ignores only a 404 on the page's own URL and 404 `?_rsc=` prefetches of `PENDING_ROUTES` (unit tested in `scripts/e2e-console.test.ts`) (#111).
- 404 and error pages: `src/app/not-found.tsx` (inside the store chrome, shared with the `(store)` layout through `withStoreChrome()` in `src/components/shell/store-chrome.tsx`), `error.tsx` (client; "Try again" calls `retry()`, which re-fetches, where `reset()` would not; logs only the error name and digest) and `global-error.tsx` (own `<html>`, inline styles); `EmptyState` (`src/components/shell/empty-state.tsx`, `src/styles/empty.css`) with a dot-matrix count at 3.6px pitch (#109).
- Cart controls and header pill (`src/components/cart/{cart-control,cart-pill}.tsx`, `src/styles/cart-control.css`): Add to cart becomes a stepper, limits and changes are announced through the single `#live` region (the count is a plain `<span>`: `<output>` is an implicit live region), the header Cart pill reads the session cart and bumps on change (#110).
- Privacy policy at `/legal/privacy` (`src/app/(store)/legal/privacy/page.tsx`): what is collected and why, DPDP Act 2023 consent and rights, sharing, OTP, session and prescription protection as built, and "To be added" for the grievance officer, customer care, storage location and retention periods (#103).
- Home quick actions and trust strip (`src/components/home/{quick-actions,trust-strip}.tsx`, `src/styles/quick-trust.css`), rendered in `src/app/(store)/page.tsx` under the banner slot: four cards (upload a prescription, search, track an order, contact) and four trust promises. The Cash on delivery subline reads "Pay when your order arrives" until `SITE_CONFIG.onlinePayments` is true, then "Or pay online with Razorpay". The search card focuses the header search field `#q` on click (`search-card-link.tsx`, the only client island; `href="#q"` is the no-JS fallback); the home root `.home` sets `--container-page: 80rem` so `.wrap` sections are 1280 wide (the global `.wrap` stays 75rem); the prescription card is a link to `ROUTES.uploadRx`, not the prototype's inline file picker (#108).
- Refunds and cancellation, Shipping, Prescription policy and Grievances pages under `src/app/(store)/legal/`, the Contact page at `/contact`, and `e2e/links.spec.ts`, which follows every same-origin link from `/`, `/contact` and each `/legal/*` page and expects 200, or 404 for a `PENDING_ROUTES` path. Prepaid refund sentences are conditional ("If you paid online") until `SITE_CONFIG.onlinePayments` goes live; the prescription page states the Schedule H and H1 rule, never a claim about the catalogue [C25]; the ₹5,000 cash on delivery cap is written in the shipping copy because no config constant holds it yet (#106).
- Category bar (`src/components/shell/category-bar.tsx`, `src/styles/catbar.css`), mounted in the `(store)` layout under the header: one link per live category in sortOrder, then All medicines. Category pages are still pending (Task 30), so those links stay in `PENDING_ROUTES`. At 880px and below it is a 36px chip row that scrolls away with the page, starting on the search field's edge and running off the screen edge (`margin-inline: 0`, gutter `padding-inline` and `scroll-padding-inline`) (#100).
- Legal page layout for every policy page: `LegalPage`, `LegalSection`, `Pending` and `Fact` in `src/components/legal/legal-page.tsx` (the Operate shell, a 62ch `.prose` column from `src/styles/prose.css`, "Last updated" from `POLICY_VERSION`, and a "To be added" chip for each unsupplied fact), and `findClaims` in `tests/helpers/claims.ts`, the invented-claims check for page tests, which also flags copy saying every medicine needs a prescription unless the page passes `allRx` from catalogue data [C25] (#98).
- Session-only UI cart store (`src/lib/cart/{cart,store,use-cart-lines}.ts`): 10 packs per product and 20 per order, slugs and quantities only, kept in `sessionStorage` under `aarv-cart-ui-v0`; `getSnapshot` returns a cached object so `useSyncExternalStore` cannot loop. The cart controls and header pill that use it follow in the next PR. Stands in until the server cart (phase K) (#102).
- Sticky store header (`src/components/shell/{store-header,skip-link}.tsx`, rest of `src/styles/header.css`): logo, search field, Upload prescription, Sign in and Cart, with a skip link before the announcement line. `search`, `account` and `cart` are slots that the live search, account and cart tasks fill. The shadow comes from an IntersectionObserver on the announcement line (no scroll listener); `--hdr-h` is 117px (108px at 880px and below) and base.css stays the only `scroll-padding-top` rule. `Brand` gained `placement="header"` (#97).
- Announcement line (`src/components/shell/announce-bar.tsx`, `src/styles/header.css`), mounted in the `(store)` layout: all three notices on desktop; at 720px and below one notice cross-fades every 5 s (skipped while the tab is hidden, and under reduced motion only the first shows) (#96).
- Styleguide demo of the Overlay (`/dev/styleguide?overlay=dialog` or `side` opens one on load, read client-side) and a phone-width Playwright check that a short drag or a tap on the sheet head replays no animation (#93).
- `Overlay` (`src/components/overlay/overlay.tsx`), the dialog and right-hand side sheet that becomes a draggable bottom sheet below 640px, with focus return to the opener (#88).
- `useDragDismiss` (`src/components/overlay/use-drag-dismiss.ts`): drag-to-dismiss for the phone bottom sheet, a hook returning pointer handlers for the sheet head; the panel keeps `is-dragging` while open so a snap-back or a tap never replays the entrance animation (#85).
- Overlay foundations: the shadcn dialog primitives (`src/components/ui/dialog.tsx`), `src/styles/overlay.css` (dialog, side drawer and phone bottom sheet as keyframes on `[data-state]`, Aarvion scrim), the shadcn colour mapping in `globals.css`, and the pure drag-to-dismiss thresholds in `src/components/overlay/drag.ts`. Adds `@radix-ui/react-dialog` and dev dependency `postcss` (for the built-CSS scrim test) (#81).
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
- `StoreFooter` and `Brand` in `src/components/shell/` with `src/styles/footer.css`; the `(store)`
  layout renders the footer (#82, #94).
- `SITE_CONFIG.onlinePayments` (default `false`) drives the footer's payment line: cash on delivery
  only until it is set to `true`, then UPI, cards and netbanking through Razorpay too. `ROUTES` also
  has the home anchors `how`, `questions` and `faqWin2age` (#92).
- `TextField` and the ported forms stylesheet (`src/styles/forms.css`, with the shared `.field-box`): 16 px text, visible labels, errors tied by `aria-describedby` and `aria-invalid`, forced-colors focus, 44 px targets, and a styleguide demo (#79).
- `Checkbox` and `Segmented` in `src/components/form/` (native checkbox and radios; the segmented control has roving tabindex, arrows, Home and End; errors are `role="alert"`), forced-colors and contrast-more rules in `forms.css` (#84).
- The customer toast (`toast()`, `dismissToast()`, `<Toaster/>`) and the page's one polite live
  region (`announce()`, `<LiveRegion/>`), both mounted at the end of `<body>` in
  `src/app/layout.tsx`, with `src/styles/toast.css` and a styleguide demo (#83).
- `OperateShell` (`main#main.operate`: forest band with title, sub line and back link, then the
  white work sheet) with `src/styles/shell.css`, including its phone rules (#94).
- The `Checkbox` and `Segmented` demo on `/dev/styleguide` (`#styleguide-forms`), alongside the `TextField` states (#91).
- `OtpField` (`src/components/form/otp-field.tsx`: input-otp behind the generated
  `src/components/ui/input-otp.tsx`, six `aria-hidden` boxes, a pasted full code replacing
  a partial value (native paste listener, `otpDigits`), once-per-code `onComplete`, shake only when motion is allowed) with
  `src/styles/otp.css` (#89).
- `OtpField` takes Android SMS autofill at the caret (a native `beforeinput` listener, since React's
  `onBeforeInput` never carries `inputType`), shortens its boxes to 54 px at 400 px and narrower, and
  the styleguide has an OTP section (#95).
- Sign-up building blocks in `src/server/auth/`: `checkOtpChallenge` confirms a code without
  consuming it (a match refunds its attempt), `findUserByIdentifier`, and users gain an optional
  `name` and a DPDP `consents` record (policy version, times, OTP channel) written on insert only;
  `PublicUser` gains `name`. Login tests send `DEFAULT_SIGNUP` from `tests/helpers/auth.ts` (#99).
- `POST /api/auth/otp/verify` accepts a strict `signup` (`name` free of control or format characters,
  `adult: true`, `termsPrivacy: true`, `marketing`; else 400 `invalid_request`); a new user stores the
  name and a DPDP consent record: version `2026-11-17` (`CONSENT_VERSION`), time, OTP channel (#107).
- `GET /api/auth/session` (`src/app/api/auth/session/route.ts`) for the store header: always 200
  with `{ user }` (the public user, now with `name`) or `{ user: null }`, never 401, `no-store`,
  re-issuing a sliding customer cookie (#107).
- A new identifier's first OTP verify must carry `signup`: without it the right code answers 409
  `signup_required` (no user, session or audit row) and is not used up, so it logs in exactly once
  when the details follow. Nothing reads the account before the code matches, so junk verifies
  behave the same for new and existing identifiers (`tests/int/auth-signup.test.ts`) (#116).

### Changed

- `normMobile` (`src/components/auth/phone.ts`) strips exactly one prefix the server also accepts (`+91`, a 12-digit `91...` or an 11-digit `0...`) and never truncates; anything that is not then exactly ten digits fails `MOBILE_RE`. Digits of other scripts (Devanagari, fullwidth) read as the digits typed, and any other stray character (a letter O, a zero-width space) makes the input invalid instead of being dropped. It used to keep the first ten digits, which turned a mistyped number into a different valid-looking one (#137, #140).
- Privacy policy copy: how sign-in codes and sessions are stored now reads "scrambled (hashed) form" instead of "keyed hash (HMAC)", and the last-updated date is stated once, at the top (#105).
- Customer routes live in the `src/app/(store)` route group, whose layout renders the store footer;
  the root layout keeps only the toast region and the single live region, so admin and staff routes
  get no store footer (this includes `/dev/*` and the 404 page). The seeded-database build
  requirement still holds, now through the `(store)` layout. URLs are unchanged (#94).
- `main` is now protected on GitHub (nine required checks, linear history, no force pushes or
  deletion) after the repository went public; `scripts/merge-gate.sh` uses `--admin` only for a
  ruled `ALLOW_OVERSIZE=1` exception (#90).
- CHANGELOG.md is back on git's default merge; the union driver from #73 silently re-added
  stale and garbled lines, so conflicts are now resolved by hand (#86).
- The root layout sets `metadataBase` from `APP_URL`, so Open Graph and icon URLs no longer
  resolve to localhost; an unset or invalid value falls back to `http://localhost:3000` instead of
  failing the build (#76).
- The `(store)` layout reads the live categories for the footer, so **every build of a customer
  route needs a seeded database**: seed the Preview DB before this merges into a Vercel-connected
  repo (#82; the read moved from the root layout to `src/app/(store)/layout.tsx` in #94).
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

- `h2.h-section` headings no longer render 144px tall: `--spacing-section` moved from `@theme static` to the plain `:root` block in `src/app/globals.css`, so Tailwind 4 stops generating an `h-section` height utility that beat the `.h-section` heading class. The value is unchanged and still read as `var(--spacing-section)`; `src/styles/section-token.test.ts` compiles the CSS and fails if the utility returns, and `tokens.test.ts` lists the token as the one `:root` exception. Also removes the `h-auto!` workaround (and its test) from the Shop by category heading in `src/components/home/category-bento.tsx` (#144)
- Form field labels (`label.label`, `TextField`) no longer render as sand shipping-label cards: the ordering steps' card rule in `src/styles/steps.css` is scoped to `.vis-label .label`, since `forms.css` owns the bare `.label`. `src/styles/css-hygiene.test.ts` now also fails when a selector repeats across `src/styles/*.css` files (C12), which is how this collision was found; `base.css`'s deliberate group selectors are the only listed exception (#124).
- `ui` tests run under Vitest 5 again: the `next/navigation` mock state moved to
  `tests/helpers/navigation-mocks.ts`, because Vitest 5 rejects exported `vi.hoisted` values
  (#57).
- The banner carousel reducer keeps a user's pause across motion changes and guards bad input
  (#64).
- `buttonClass()` and `ButtonLink` are server-safe again: only `Button` is a client module
  (`button.client.tsx`, re-exported from `button.tsx`). The `/dev/*` 404 also sends no-store and
  noindex headers (#77).
- The toast no longer dismisses a toast its own action raised, its action button meets the 44 px
  target, a second `<LiveRegion/>` renders nothing, and plain toasts have a Dismiss button and
  Escape (#87).
- A rate-limit store error while clearing the failure counter after a successful OTP verify no
  longer turns the login into a 500 with a session the client never receives; it is logged by
  error name, like a failed audit write (#99).
- Sign-up names may hold a zero-width joiner or non-joiner (U+200D, U+200C) between two letters
  or marks, as Indic spellings such as the Marathi eyelash ra need; #107 refused them. Every other
  control or format character is still refused (#116).
- Sign-up names also refuse default-ignorable characters, such as a Hangul filler (renders blank)
  or the combining grapheme joiner, which #107 let through; the joiner exception above still
  holds. The name rule has a unit table in `src/server/auth/login.test.ts` (#121).
- `findUserByIdentifier` and `findOrCreateUserByIdentifier` filter `{ $eq, $type: "string" }`, so
  they use the partial unique indexes instead of scanning every user (#116).
- The banner carousel hook's `go()` ignores a non-integer index on phones too (it used to scroll the track to slide 1), and a tab opened in the background starts with the `hidden` hold, so autoplay never runs unseen. A dot fill that ends in the frame a hold or the pause starts is kept as `due` and advances once autoplay can run again, so the banner can no longer stall on one slide (#113).
- The footer logo no longer competes with a page's LCP image: the footer passes `loading="lazy"` through `BrandMark`'s new `loading` prop, so React stops preloading it ahead of the content (the header logo stays eager) (#129).

## [0.1.0] - 2026-11-17

The groundwork, Phase F (foundation) and Phase CA (catalogue, auth and order domain, server
side). Covers the merged PRs #1–#44. #12, #24 and #34 were closed without merging (superseded
by fresh branches), and #9 was closed because `@types/node` majors are ignored (the runtime is
Node 24).

### Added

- Country of origin, the product facts block and the strength switcher, the parts Task 32's product page assembles: `countryOfOrigin()` (`src/lib/catalogue/origin.ts`) answers "India" only when the manufacturer address names a place from `INDIAN_ADDRESS_MARKERS` (whole word, any case, not a street name; a six-digit number alone is not trusted), else null (never guessed); `ProductFacts` (`src/components/product/product-facts.tsx`) is the `dl.product-facts` of Legal Metrology declarations (composition table, dosage form, net quantity, MRP inclusive of all taxes, manufacturer, marketer, country of origin, customer care from `SITE_CONFIG.customerCare`) with "To be added" for any unknown fact; `VariantSwitcher` is a script-free `nav[aria-label="Strengths"]` of links in `compareVariants` order with `aria-current="page"`, rendered only for a family of two or more. Styles are `src/styles/product-facts.css`; `/dev/styleguide` shows both (#131).
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
