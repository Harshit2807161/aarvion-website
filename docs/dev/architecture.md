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
| `src/app/` | routes: pages, layouts, route handlers and `globals.css` |
| `src/components/` | React components |
| `src/config/` | site facts and the route map |
| `src/fonts/` | committed font subsets |
| `src/lib/` | client-safe helpers: classes, formatting, catalogue display, cart |
| `src/proxy.ts` | the `/dev/*` 404 guard |
| `src/server/` | business logic (see Server modules) |
| `src/styles/` | ported prototype CSS and its tests |
| `components.json` | shadcn/ui config |
| `tests/` | integration tests and their helpers |
| `e2e/` | Playwright specs |
| `scripts/` | build, seed and asset tools |
| `data/` | seed data and generated image data |
| `public/` | served static assets |
| `assets/` | source photos, cutouts, logo masters and fonts |
| `design/prototype/` | the approved hi-fi prototype |

File-by-file detail is below, one file or subfolder per line, sorted alphabetically. When you
add or change a file, edit only its own bullet.

Planned folders (UI plan): more of `src/components/**` and `src/lib/**`. See
the plan's "File Structure".

### src/app/

- `src/app/(store)/`: route group for customer pages (URLs unchanged):
  - `layout.tsx` wraps the page in `withStoreChrome()` (`src/components/shell/store-chrome.tsx`: `SkipLink`, `AnnounceBar`, `StoreHeader` (with `AccountPill` in its `account` slot and `CartPill` in its `cart` slot), `CartReconcile`, `CategoryBar` (live categories), the page, then the `StoreFooter` from the cached live categories), so **every build needs a seeded database**
  - `legal/privacy/page.tsx` and `legal/terms/page.tsx` are the privacy policy (`/legal/privacy`) and the terms of use (`/legal/terms`, whose payment section offers only cash on delivery, naming no online method, until `SITE_CONFIG.onlinePayments` is true), each a `LegalPage` whose copy may state only what `docs/requirements.md`, `PRODUCT.md`, the rulings and the code as built support, with unsupplied facts as `Pending` (bump `POLICY_VERSION` when a policy changes in substance)
  - `legal/{returns-cancellation,shipping,prescription-policy,grievance}/page.tsx` and `contact/page.tsx` are `LegalPage` policies and the contact page (prepaid refund wording stays conditional, "If you paid online", until `SITE_CONFIG.onlinePayments` is true; the prescription page states the Schedule H and H1 rule and never says every medicine needs a prescription [C25]; the ₹5,000 COD cap is copy, not config).
  - `page.tsx` is the home: `main#home.home` (`.home`, the one root rule for the home's 1280px `--container-page` and `--space-sec`, is in `src/styles/quick-trust.css`), an sr-only h1, inside `FilmRoot` (the scroll film's root), then `HeroBanner`, `QuickActions`, `TrustStrip`, `CategoryBento`, `Rails`, `OrderingSteps`, `Faq` and `Close`; it is async (it reads `getCachedProducts()` and `getCachedCategories()` and builds `homeModel`); the other home sections land with the remaining UI Tasks 21–29
  - `login/page.tsx` is `/login`: `main#main.auth-page` with the intro, the `.auth-card` holding `LoginFlow mode="page"` inside a Suspense boundary after `connection()` (so `?next=` and `allowDemo={!isMockForbidden()}` are decided per request, and client code never imports `src/server`), then `ul.auth-why`; `noindex`, `interactiveWidget: "resizes-content"`; CSS in `src/styles/auth.css`
  - `category/[slug]/page.tsx` is the category page: `generateStaticParams` from the cached categories, `notFound()` for a slug that is not live or coming soon, and `CategoryView` (`src/components/catalogue/category-view.tsx`) with the cached products of that category, the first pocket with `priority`; `ensureStatic = "navigation"` makes an unlisted slug wait for its static result, so a hidden or unknown slug answers 404 on its first request
  - `not-found.tsx` renders the shared `NotFoundBody` (`src/components/shell/not-found-body.tsx`) inside the layout's chrome, so a category or product 404 shows one header, one `#q` and one footer; the root `not-found.tsx` (URLs that match no route) wraps the same body in `withStoreChrome()`
  - `page.tsx` is the home: `main#home.home` (`.home`, the one root rule for the home's 1280px `--container-page` and `--space-sec`, is in `src/styles/quick-trust.css`), an sr-only h1, then `HeroBanner`, `QuickActions`, `TrustStrip`, `CategoryBento`, `Rails`, `OrderingSteps`, `Faq` and `Close`; it is async (it reads `getCachedProducts()` and `getCachedCategories()` and builds `homeModel`); the other home sections land with the remaining UI Tasks 21–29
  - Admin and staff routes go in a sibling group (for example `(admin)`) with no footer, as do `/dev/*` (their 404s come from the proxy and are bare).
  - the Operate *shell* (`OperateShell`) is a page component that customer cart, account and policy pages use inside `(store)`
- `src/app/api/auth/logout/route.ts`: `POST /api/auth/logout` (204, clears the cookie)
- `src/app/api/auth/me/route.ts`: `GET /api/auth/me` (re-issues a sliding customer cookie)
- `src/app/api/auth/otp/send/route.ts`: `POST /api/auth/otp/send`
- `src/app/api/auth/otp/verify/route.ts`: `POST /api/auth/otp/verify` (sets the session cookie; 409 `signup_required` for a new identifier without `signup`)
- `src/app/api/auth/session/route.ts`: `GET /api/auth/session` for the header: always 200 `{ user }` or `{ user: null }` (never 401), `no-store`, re-issues a sliding customer cookie
- `src/app/api/health/route.ts`: `GET /api/health`: version plus a DB ping
- `src/app/api/products/route.ts`: `GET /api/products?q=&strength=` for the header search: `q` up to 64 characters (400 `query_too_long`), `strength` 1 to 6 digits (400 `invalid_strength`), 60 a minute per IP bucket on `search:ip:<bucket>` (429 `rate_limited` with `Retry-After`), reads `getCachedProducts()` (never the DB), filters with `matchesTokens` and `strengthTokens`, returns at most 20 `SearchResult`s (`src/lib/catalogue/search-result.ts`: `searchProducts` is the pure filter and holds `SEARCH_LIMIT`, `MAX_RESULTS`, `STRENGTH_RE`; a result is slug, name, salt, pack, mrpPaise, pricePaise, image; no composition array, `internalNotes` or `mrpSource`), `no-store`, and logs no query text
- `src/app/dev/outbox/route.ts`: `GET /dev/outbox?to=` (dev only)
- `src/app/dev/styleguide/page.tsx`: `/dev/styleguide` (dev only): every button variant, the Rx badge, tags, stamp and inline prices, the OTP field (`otp-demo.tsx`), the toast demo (`toast-demo.tsx`) the dialog / side sheet demo (`?overlay=dialog` or `side` opens one on load; read client-side in `overlay-demo.tsx`, never via page `searchParams`), the product facts and strength switcher (`#styleguide-facts`) and the foil pockets (`#styleguide-pockets`: every product from `getCachedProducts()` on print-field foil at the rail widths; it needs the seeded database; when the read fails it logs the error name and shows a hint) and the icon grid, for visual review
- `error.tsx` (page errors, client component, `retry` button, logs only the error name and digest)
- `global-error.tsx` (its own `<html>`, inline styles) show no chrome.
- `src/app/globals.css`: Tailwind 4 entry: the design tokens in `@theme`, copied verbatim from the prototype (Prettier-ignored), and the plain custom properties in `:root` (durations, z-layers, `--spacing-section` (kept out of `@theme`: a `--spacing-*` token there makes Tailwind emit an `h-section` height that overrides the `.h-section` heading class; use `var(--spacing-section)`), `--sticky-top`, the shadcn roles, and the foil material `--foil-body`, `--foil-print`, `--perforation` and `--perf-v` with `/foil/…` URLs into `public/foil/`, defined once here for the pockets, rails and the ordering steps)
- `src/app/layout.tsx`: root layout (`lang="en-IN"`, viewport, theme colour, `metadataBase` from `APP_URL`) around every route, with the `Toaster` and the page's one `LiveRegion` (exactly one may exist, so they live only here). Keep exactly one `<LiveRegion/>`, in the root layout
- `src/app/sitemap.ts` and `src/app/robots.ts`: `/sitemap.xml` lists absolute URLs for the home page, the live categories, every public product, the six policies and contact (never `/login`, `/dev`, `/api`, cart or account); `/robots.txt` allows crawling only when `VERCEL_ENV=production` (disallowing `/api/`, `/dev/` and `/login`, and naming the sitemap) and disallows everything elsewhere. Both use `getSiteEnv()` and `siteUrl()`, so production without a valid `APP_URL` fails the build
- The root `src/app/not-found.tsx` (URLs that match no route) sits outside `(store)` but calls `withStoreChrome()` itself, so a shopper who lands on a dead link still gets the search and the footer
- A `usePathname` caller in the store chrome is wrapped in its own Suspense with a static fallback (`SkipLink` falls back to the plain `<a class="skip" href="#main">`); never wrap layout children. `HeaderSearch` reads `window.location.pathname` at click instead of the hook, since a boundary delays its hydration.

### src/proxy.ts

- `src/proxy.ts`: answers a real HTTP 404 for every `/dev/*` request wherever `isMockForbidden()` is true, before anything renders

### src/components/

React components, added task by task. The folders below exist today:

- `auth/`:
  - `account-pill.tsx`: `AccountPill` (client, the header's `account` slot; one per page): a real `/login` link (`[data-account-pill]`, "Sign in") until `fetchSession()`, asked once the page is idle, says otherwise; signed in it is `[data-signed-in]` "Account" with the sand initial (first grapheme), `aria-label` "Your account", linking to `ROUTES.account`; one width either way (7.5rem, 44px at 880px and below); a plain click on Sign in opens `LoginDialog` (except on `/login` itself), a modified click keeps the link; `openLogin(next?)` sends `LOGIN_EVENT` (`aarv:login`) on `window`, which the pill answers by opening the dialog; no `usePathname`, so no Suspense
  - `api.ts` (`sendCode`, `verifyCode`, `fetchSession` over `/api/auth/otp/send`, `/api/auth/otp/verify` and `/api/auth/session`; nothing throws, and a transport failure, a 15 s timeout, a non-JSON or unexpected 2xx body or any other unexpected status maps to `network`, except a 400 on send (`invalid_identifier`) and a 400 or 413 on verify when a `signup` was sent (`signup_required`: the server refused the name); `verifyCode` trims the name; `fetchSession` exposes only `{ name }`; `SignupPayload` is pinned both ways to the server's `SignupInput` by a type-only import in `api.test.ts`; name validation stays server-side; nothing logs identifiers, codes or names)
  - `code-step.tsx`: `CodeStep` runs verify, resend ("Send a new code", busy copy while sending; the main button once a tries-lock may be replaced) and Change (back to the id step, focused); a short code says `incomplete`; at most one verify in flight (a ref plus `busy`) and a rejected code is never resent until it changes; network and daily locks count down live from `lockedUntil` via `liveCodeMessage`; messages are spoken through `announce()` and `.auth-alert` has no role, so a countdown never re-announces
  - `demo-states.ts`: `LOGIN_DEMO_STATES` (`otp-sent`, `otp-error`, `otp-locked`, `new-account`), `isLoginDemoState` and `demoLoginState(name, now)`, each state reached by driving the real `loginReducer` with fixture events (mobile `9876543210`, code `482913`); `LoginFlow` opens one from `?state=` (read in an effect) only when the page passes `allowDemo={!isMockForbidden()}`, so never in production
  - `load-login-dialog.ts`: `loadLoginDialog()`, the one dynamic import of the dialog, so the dialog and the whole login flow stay out of every page's first-load JS (and tests can count loads)
  - `login-copy.ts` (`LOGIN_COPY`, the whole login flow's customer copy; `mmss` and `waitText`, which print "a little while" for a missing wait, never NaN; `MAX_TRIES`, `RESEND_SEC` and `CODE_TTL_MS`, client copies pinned to the server's limits by the test; `nameRefused` is the server refusing the name, `nameInvalid` the client check)
  - `login-machine.ts`: the login state machine over steps id, code, profile and done: `loginReducer`, `initialLoginState`, `identifierOf` (post exactly this); `busy` is a guard, so a busy state ignores every event but results and `tick`, and an idle state ignores results; the UI runs the effects, calling `sendCode` and `verifyCode` while a state is `busy` (a resend is `resendStart`, then `sendCode`); `codeMessage(state, now)` is the code field's message, and `tick` lifts timed locks; when a code or profile state has `sessionCheck` true the UI calls `fetchSession()` and dispatches `sessionChecked`, because a verify that ended in `network` may still have signed in; `nameRefused` is the server refusing the name, `nameInvalid` the client check, `nameTooLong` a name over 80 characters; it re-exports
  - `login-dialog.tsx`: `LoginDialog({ open, onOpenChange, next, onSignedIn, returnFocusTo })`, the login flow in an `Overlay` dialog (a bottom sheet below 640px) named "Sign in", with the mint swoosh as its head `mark`, that opens on the flow's identifier field and returns focus to `returnFocusTo`; after `DONE_MS` it closes and calls `onSignedIn` first (the header lives in the persistent layout), then `router.push`es `sanitizeNext(next)` when given or toasts "Signed in as <first name>"; closing during the done step skips the redirect and toast but still calls `onSignedIn`, once; in dialog mode the flow ignores the host page's `?next=`; opened by `AccountPill`
  - `login-flow.tsx`: `LoginFlow` (client, mounted by `/login` and `LoginDialog`; an optional `next` prop overrides `?next=`; `DONE_MS` = 900) drives `loginReducer` and renders the id step (the Mobile/Email `Segmented`, the field with its own `role="alert"` error, the busy Send; posts exactly `identifierOf(...)`) and the done step ("You’re signed in", focused, with `doneCheckout` when `next` starts with `/checkout`); the dialog gets `onDone` at once and the page `router.replace`s `sanitizeNext(next)` undecoded 900 ms later; a visitor already signed in skips the done step and goes at once; when the machine sets `sessionCheck` it calls `fetchSession()` and dispatches `sessionChecked`
  - `phone.ts` (`normMobile` (strips one `+91`, `91` or `0` prefix, never truncates), `formatMobile`, `MOBILE_RE`, `EMAIL_RE`)
  - `profile-step.tsx`: `ProfileStep`, the sign-up step after a 409 `signup_required`: full name, the required 18+ and terms consents (the terms label links to `ROUTES.legal.terms` and `.privacy` in a new tab, so the held code is not lost, each with a visually hidden `LOGIN_COPY.newTab` "(opens in a new tab)") and the optional marketing one; it re-sends the held code with `signup`; two or more invalid fields show one focused `ErrorSummary` with `errorAlert={false}` on the fields, one keeps its own alert and takes focus; `nameRefused` and `nameTooLong` land on the name field; a 429 counts down live from `lockedUntil`
- `base/`: the icon set
  - `BrandMark`
  - `Button` (the only client module of the button family: `button.client.tsx`, re-exported from `button.tsx`; its busy handler needs a client component)
  - `ButtonLink` and `buttonClass` (server-safe, in `button.tsx` and `button-class.ts`)
  - `PriceInline`
  - `Rupees`
  - `RxBadge`
  - `StampPrice`
  - `StatusTag`
- `cart/`:
  - `CartControl` (Add to cart that becomes a stepper; changes and limits are spoken only through `#live`; the count is a plain `<span>`, since `<output>` is an implicit live region)
  - `CartPill` (header cart link, count bumps on change)
  - `CartReconcile` (renders nothing; drops stored lines for slugs the catalogue no longer has, ignores an empty catalogue, and announces once through `#live`)
  - all fed by the store in `src/lib/cart/`
- `catalogue/`: `Pocket` (the foil pocket, the product card of the rails, category and product pages: `li.pocket#p-<slug>` with the pack under a dome, the name and `RxBadge`, the actives clamped to two lines (three on phones) with the full composition in the title and for AT, the pack line, `StampPrice` and `CartControl`; the name is `a.pocket-link` to `ROUTES.product(slug)`, the Rx badge outside the link; `heading` sets its level, and `priority` makes its image eager with `fetchPriority="high"`, never a preload [C24]; images are lazy otherwise; no hooks, so it renders on the server or in a client tree; CSS in `src/styles/pocket.css`)
- `feedback/`: the customer toast (`toast()`, `dismissToast()`, `<Toaster/>`) and the page's single polite live region (`announce()`, `<LiveRegion/>`), both mounted at the end of `<body>` in `src/app/layout.tsx`
- `film/`: the scroll film:
  - `progress.ts`: the pure maths.
  - `engine.ts`: `createFilm`, one passive scroll listener and one rAF tick, an IntersectionObserver that marks the acts near the viewport `.live`, `measuring` set on `#home` only while it measures, and the `?p=<act>:<progress>` capture jump after load. With `film: false` it does nothing at all.
  - `film-root.tsx`: `FilmRoot` (server), `main#home.home.film-root`. An inline script adds `film` before first paint when motion is allowed, then the sections, then the engine. The server HTML is the full static page, so no JS or reduced motion shows everything.
  - `film-engine.tsx`: `FilmEngine` (client, renders null) starts the engine (which adds `is-running` to `#home`; the pinned layout and hidden start states key on `.film.is-running`, so a page whose engine never runs keeps the static layout) in a layout effect and adds `film` for a soft navigation.
  - CSS in `src/styles/film.css`.
- `form/`:
  - `Checkbox` (the same for its error, including `errorAlert`)
  - `ErrorSummary` (`error-summary.tsx`: the submit summary DESIGN.md asks for, a `.errsum` box titled "There’s a problem"/"There are N problems" listing each error as a link that scrolls its field to the centre (smoothly unless reduced motion) and focuses it, leaving modified and non-primary clicks to the browser; it takes focus whenever `focusKey` changes and is not a live region or alert, so the fields it covers pass `errorAlert={false}`; CSS at the end of `src/styles/forms.css`)
  - `OtpField` (one real input drawn as six boxes, with native paste and `beforeinput` listeners so a pasted or autofilled full code replaces a partial value; pass `ariaLabel` when there is no `<label for>`)
  - `Segmented` (native radiogroup with roving tabindex, arrows, Home and End; LTR only; no error wiring)
  - `TextField` (hint and error ids through `aria-describedby`, `aria-invalid`; the error has `role="alert"` unless `errorAlert={false}`)
  - `otpDigits`
- `home/`: the banner carousel reducer and controller hook
  - `CategoryBento` (the static "Shop by category" act, `section#areas[data-act="pass"]`; tiles come from `bentoTiles(homeModel(...))`, whose `BENTO_LAYOUT` picks each category's grid cell and art slugs, so a new live category gets a plain `tile-diab` cell; the `data-in` ranges on the tiles are what the film engine reads; CSS in `src/styles/bento.css`)
  - `Close` (the static closing act, `section#close[data-act="pin"][data-lead]`; `img.close-swoosh` is the mint `/brand/aarvion-mark.svg` alone, 184px, and carries the film's `data-in` pan-in range itself; CSS in `src/styles/faq-close.css`)
  - `Faq` (`section#questions`, six native `<details>`; `#faq-returns` and `#faq-win2age` are link targets and `FaqHashOpen`, a tiny client effect, opens the item a hash points at; the Rx-universal first answer needs `allRx` [C25] and the online-payment copy needs `SITE_CONFIG.onlinePayments`)
  - `HeroBanner` (server; picks the slides with `bannerSlides()` and renders each one's `getImageProps` picture, the first one shown eager with `fetchPriority="high"`; slides 2 to 4 carry `data-src` / `data-srcset` and get their real sources from the hook after window load, because even lazy images are fetched before `load` when near the viewport; each also has a sibling `<noscript>` picture so a no-JS phone can swipe to a real image) inside `BannerCarousel` (client; controls first, then the track of server-rendered slides; the hook alone sets each slide's `is-current`, `is-leaving`, `inert` and image `loading` and reveals the later slides' sources (`revealSlideImages`); styles in `src/styles/banner.css`)
  - `OrderingSteps` (the static "How ordering works" act; its hooks `data-act`, `data-in`, `data-out`, `.step` and `.is-active` are what `film/` reads, so do not rename them; CSS in `src/styles/steps.css`)
  - `Rails` (server; `div.meds#medicines` holding a `section.rail#<categoryAnchor>` per `railPlan()` rail, with an empty `span.anchor` for each category folded into the shared rail, `data-act="pass"` / `data-in` for the film, a `[data-rail-controls]` slot holding `RailControls` (client: the arrows, which page the row by 80% of its width and are `aria-disabled` at each end, and "View all N", a link to `ROUTES.category(slug)` that is always visible on a rail of one category; the shared rail passes no `slug` and shows none; the arrows appear only while the row overflows and scrolling is instant under reduced motion), every pocket image lazy, and the Rx note only when `model.allRx`; CSS in `src/styles/rails.css`)
- `legal/`:
  - `Fact` (a `SITE_CONFIG` value, or `Pending` while unset)
  - `legalMetadata`, for every policy page
  - `LegalPage` (the Operate shell plus the `.prose` column, opening with "Last updated" from `POLICY_VERSION` via the pure `formatPolicyDate`)
  - `LegalSection`
  - `Pending` (the "To be added" chip)
- `overlay/`: `Overlay` (dialog and side sheet; `initialFocus` is a ref or a function called at open; an optional `mark` renders in the head before the title, `.sheet-mark`), the drag thresholds and `useDragDismiss`
  - `src/components/overlay/`: `Overlay` (`variant` `"dialog"` or `"side"`, `title`, `count`, `closeLabel`, `initialFocus`, `returnFocusTo`, `footer`): Radix Dialog supplies the focus trap, Escape, scroll lock and aria-hidden siblings; `Overlay` adds `aria-modal`, returns focus to whatever opened it, or to `returnFocusTo` (Radix only does that for its own Trigger; Safari and Firefox on macOS leave `body` focused after a mouse click, so pass `returnFocusTo` for click-opened overlays) and puts the drag handlers on the sheet head only (never the panel, where a drag would fight the scrolling body). Below 640px it is a bottom sheet (CSS).
  - Also the pure phone bottom-sheet drag thresholds in `drag.ts` (28% of height, or 24px at 0.45px/ms)
  - `useDragDismiss`, which returns pointer handlers for the sheet head. The panel follows the finger through an inline transform and carries `is-dragging` from the first pointerdown until it closes (that class holds the CSS open animation off; removing it while open would replay the entrance). Only the inline transition is cleared after a snap-back
- `product/`:
  - `ProductView` (the product page body: the `Gallery` beside the buy box in the fixed order brand, composition, pack, price, then `VariantSwitcher`, `CartControl`, the order limit and the Rx note (only when `rxRequired`), then the facts and up to four related `Pocket`s; the page is `src/app/(store)/product/[slug]/page.tsx`, prerendered by `generateStaticParams`, with `export const ensureStatic = "navigation"` so an unprerendered slug waits for its static result and `notFound()` is a real 404 on the first hit and `generateMetadata` (title = the product name, description = composition and pack) awaits `params` safely for the same reason; `dynamicParams` cannot be used with Cache Components)
  - `Gallery` (JS-free scroll-snap track with 64px thumbnail anchors; the first photo is the LCP, eager with `fetchPriority="high"`, never preloaded [C24]; Win2Age caption when `imageSource` is `win2age`)
  - `ProductFacts` (server-safe `dl.product-facts`: the Legal Metrology declarations in fixed order, ending with customer care from `SITE_CONFIG.customerCare`; an unknown fact is `Pending`)
  - `VariantSwitcher` (`nav[aria-label="Strengths"]` of real links to `ROUTES.product(slug)` in `compareVariants` order, `aria-current="page"` on the current strength, nothing for a family of one; no script and no live region; CSS in `src/styles/product-facts.css`)
- `search/`: the header search, mounted by `withStoreChrome` in the `StoreHeader` `search` slot on every customer page (404s included):
  - `HeaderSearch` (client; the `form.search` with `input#q`, the strength chips and the panel; `STRENGTH_CHIP_FAMILY` and `strengthChips` in `strength-chips.ts` give the chips from the family's variants, none if it is gone; Escape on a chip closes the panel and refocuses `#q`; focus opens it, pointer and mouse down on the chips are prevented so a press does not blur the input, `focusout` outside the form closes it, submit and Enter choose the first or active result; on `/` a result whose `#p-<slug>` pocket exists is scrolled into view, marked `is-found` and its Add or + is focused, anywhere else it goes to `/product/<slug>`; the count is announced through `announce()`, a 429 shows "Too many searches" and is never retried; Escape closes the list, then clears the field, and stops bubbling to ancestor handlers while it does either (a Radix dialog listens in the capture phase and is not protected; one mounting this search would need its own guard); a `[data-search]` click anywhere focuses `#q`; without JS it is a GET form to `/#medicines`), and its parts:
  - `highlight` (pure, no RegExp)
  - the `SuggestionList` listbox (shelf order kept; styles in `src/styles/search.css`)
  - `useCombobox` (WAI-ARIA 1.2 combobox keys and ids; no live region of its own)
  - the search hook `useProductSearch` (`SEARCH_DEBOUNCE_MS` = 150; no request for an empty query without a strength; 429 is `limited`, not retried until the query changes; nothing logs query text)
- `shell/`:
  - `AnnounceBar` (client; rotates one notice per 5 s at 720px and below unless reduced motion)
  - `Brand` (`placement` `footer` or `header`)
  - `CategoryBar` (server; live categories then All medicines; skips anything not live; each link is a `CategoryBarLink`, a client link that sets `aria-current="page"` on the current path, in the 880px chip row too; the `usePathname()` leaf is in `Suspense` with the plain link as fallback)
  - `EmptyState` (dashed well with a dot-matrix count, title, copy and actions)
  - `OperateShell`
  - `SkipLink`
  - `StoreFooter`
  - `StoreHeader` (client; `search` (`HeaderSearch`), `account` (`AccountPill`) and `cart` slots with static defaults; `is-stuck` shadow from an IntersectionObserver on `[data-announce]`, never a scroll listener)
  - `withStoreChrome` (the shared store chrome)
- `src/components/ui/dialog.tsx`: the shadcn dialog primitives, restyled for Aarvion (generated, edited)
- `src/components/ui/input-otp.tsx`: the shadcn `InputOTP` wrapper, trimmed to the one part `OtpField` uses (generated, edited; no `lucide-react`)

### src/config/

- `routes.ts` (`ROUTES`, the one map of store links, and `PENDING_ROUTES`, the linked pages that must still 404 until built; each page's task deletes its entry)
- `site.ts` (`SITE_CONFIG`: legal name, address, and the pending legal facts, all `null` until the owner supplies them; `legalValue()`, `pendingLegalFields()`, and `assertLegalConfigComplete()`, the H4 production gate; `resolveSiteMetadataBase()`)

### src/fonts/

- `src/fonts/`: committed `.woff2` subsets and `index.ts` (`next/font/local`), built by `pnpm fonts:subset` from `assets/fonts/`

### src/lib/

- `cart/`: the session-only UI cart:
  - `cart.ts` the record-shaped UI cart; `CART_LIMITS` and `CartBlock` are re-exported from `src/server/cart/rules.ts`, and `applyCart` delegates to its `addLine` and `setLineQty`
  - `store.ts` `cartStore` over `sessionStorage` key `aarv-cart-ui-v0` with a cached `getSnapshot` and a frozen `{}` server snapshot
  - `use-cart-lines.ts` the client hook
  - It holds slugs and quantities only, never prices (those come from the catalogue when rendered), capped at 10 per product and 20 per order. It stands in until the real server cart arrives in phase K, which replaces it.
- `catalogue/banners.ts` (the home banner slides and the banner fallback: `bannerSlides()` keeps a slide only while its packs are live and never lets a Win2Age pack lead)
- `catalogue/display.ts` (client-safe wording of catalogue data, ported from the prototype's `build.mjs`: `fullComposition`, `actives` (preservatives and salt forms dropped, each strength one non-breaking unit), `packDisplay`, `strengthTokens`, `shortName`, `plural`, `countWord`, `pocketImage` (the cutout, else the first photo), `categoryAnchor` and the `PocketProduct` type; type-only imports from `src/server`)
- `catalogue/home-model.ts` (client-safe model of the home bento and rails: `homeModel`, `bentoTiles`, `tileList`, `BENTO_LAYOUT`, and `railPlan` / `RAIL_RISES` for the rails: a rail per category with two or more products, then one shared rail, titled "Diabetes and respiratory care" or "More medicines", for the single-product categories; imports only `catalogue/order` at runtime)
- `catalogue/origin.ts` (`countryOfOrigin(manufacturer)`: "India" iff the address names an Indian place from `INDIAN_ADDRESS_MARKERS` (whole word, any case, not a street name), else null, so the page shows "To be added"; extend the marker list, never guess)
- `catalogue/json-ld.ts` (`productJsonLd(p, base)`: schema.org Product with the selling price, the manufacturer's name only when the catalogue has one, and never `availability`, `aggregateRating` or `review`; `jsonLdScript` escapes `<`; `productMetadata(p)`: the title (name and actives), the MRP and price description, the canonical path and the share image; the product page renders one `application/ld+json` block)
- `cn.ts` (`clsx` + `tailwind-merge` class helper)
- `format/rupees.ts` (Indian rupee formatting)
- `site-url.ts` (`siteUrl()`: `APP_URL` through `getSiteEnv()` and `resolveSiteMetadataBase`, else `http://localhost:3000`, but a production deploy without a valid `APP_URL` throws; server-only; used by the sitemap, robots and JSON-LD)
- Also `next-url.ts` (`sanitizeNext(raw)`: the `?next=` guard for post-login redirects; returns "/" unless the value is a same-origin path of at most 512 characters with no backslash or control character and not under `/login`, `/api/` or `/dev/`; it checks the resolved output, because dot segments collapse (`/.//x` becomes `//x`), and blocks the prefixes case-insensitively (a malformed percent escape returns "/"); use it for every `next` read from a URL and pass the result straight to `router.replace`/`push`/`redirect`, never decode it)

### src/server/

- `src/server/`: business logic (below)

### src/styles/

ported prototype CSS imported by `globals.css`.

- `auth.css`: the /login page and the login card, `.auth-*`, `.otp-meta`, `.otp-timer` (flows.css v2 360-399 and its responsive auth rules); the Change link's hit area is padded to 44px
- `banner.css`: the home banner carousel, `.hero*`, `.slide*`, `.dot-fill` and `@keyframes dot-run`
- `banner.test.ts` (the autoplay fill equals `AUTOPLAY_MS` and pauses under a hold or the pause)
- `base.css`: one merged `@layer base` with resets, focus, type and utilities
- `bento.css`: the home's category bento, `.areas`, `.sec-head`, `.bento`, `.tile*`, `.ta*`
- `buttons.css`: `.btn*`, `.link`, `.spin`
- `cart-control.css`: `.cart-ctl`, `.btn-add`, `.stepper`
- `catbar.css`: the category bar and the 880px chip row, `.catbar*`
- `category.css`: the category page's foil sheet, coming-soon panel and other-category pills, `.cat-*`
- `css-hygiene.test.ts`
- `empty.css`: the empty-state well, `.empty*` and `.well-count`
- `faq-close.css`: the home's questions and closing act, `.faq*`, `.act-close`, `.close-*` (static; `.act-close .field` is scoped because `forms.css` owns `.field`)
- `film.css`: the scroll film, every rule under `.film.is-running` (the ordering act pinned 200lvh and the close 110lvh, 160lvh and 80lvh on phones; motion is transform and opacity only, from `--ti` / `--to`; `.film-root.measuring` is a descendant selector, never `html.measuring`)
- `footer.css`: the store footer, `.foot*`
- `forms.css`: `.field`, `.field-box`, `.input`, `.check*`, `.seg*`
- `header.css`: the announcement line and store header, `.announce*`, `.store-head`, `.sh-*`, `--row-h` and `--hdr-h`
- `otp.css`: `.otp*`
- `overlay.css`: `.sheet-*` dialog, side drawer and phone bottom sheet, as `@keyframes` on Radix `[data-state]`
- `overlay.test.ts` (compiles `globals.css` and checks the scrim rule)
- `pocket.css`: the product card, `.pocket*`, `.blister` (the dome over `dome-floor.webp`, `--bh` 188px) and `.str`
- `product.css`: the product page layout, `.product`, `.gallery*`, `.buy*`, `.rx-note`, `.related*`
- `product-facts.css`: the product facts block and strength chips, `.product-facts*`, `.strengths`, `.strength-chip`
- `prose.css`: the policy reading column, `.prose*` (62ch, title-size h2, hairlines between sections) and the `.pending` "To be added" chip
- `prose.test.ts`
- `quick-trust.css`: the home quick-action cards and trust strip, `.quick`, `.qa*`, `.trust*`, and the `.home` 1280 width token
- `rails.css`: the home product rails, `.meds`, `.rail*` (strip, row, aside, the `[data-rail-controls]` slot, the arrow and "View all" rules, the `.is-open` / `.is-grid` sheet) and the phone scroll-snap row (`--pw` at least 164px)
- `section-token.test.ts` (compiled CSS has no `.h-section` height)
- `shell.css`: the Operate shell, `.band*` and `.work*`
- `shell.test.ts`
- `stamp.css`: `.dm`, `.stamp*`, `.off`, `.price-inline`, `.rx`, `.tag*`
- `steps.css`: the home's ordering act, `.act-steps`, `.step*`, `.perf*`, `.doc*`, `.log*`, `.label*` (static rules only; `.film` rules come with the film wiring)
- `toast.css`: `.toast*`
- `tokens.test.ts`
- all but `base.css` are imported `layer(components)`

### components.json

- `components.json`: shadcn/ui config; only `dialog` and `input-otp` may be added (UI plan ruling). After `shadcn add`, swap `lucide-react` for `Icon`, import Radix as `@radix-ui/react-dialog`, remove any `lucide-react`, `tw-animate-css` or `cn` package the CLI adds, revert its `globals.css` edits, and put `// @generated shadcn` on line 1

### tests/

- `tests/int/`, `tests/helpers/`: integration tests and their helpers

### e2e/

- `e2e/`: Playwright specs

### scripts/

- `db-indexes.ts`
- `merge-gate.sh`
- `pr-size.ts`
- `seed.ts`
- `shoot.mjs` (screenshots; `--viewport-only`, `--motion`, `--click <selector>` and `--wait <ms>`)
- `subset-fonts.ts`
- `vercel-build-gate.ts` (run by `pnpm vercel-build` before `next build` on Vercel: fails unless `FILE_STORE=blob` and `BLOB_READ_WRITE_TOKEN` are set)
- `sync-product-images.ts`
- Python asset tools
  - `build_stage0_docs.py`
  - `composite_store_banners.py`
  - `make_cutouts.py`
  - `render_foil.py`
  - …

### data/

- `product-images.json` (generated)
- `products.json` (seed source)
- `source/` (Drive analysis)

### public/

- `public/brand/`: the official logo variants and app icons served to the site, copied from the masters (usage guide in its README)
- `public/foil/`, `public/banners/`: foil, dome and banner rasters copied unchanged from `design/prototype/assets/`, each with a `.json` provenance sidecar (`scripts/public-provenance.test.ts`)
- `public/products/`: generated, content-hashed product images

### assets/

- `assets/`: source photos and cutouts; `brand/official/` (the traced logo masters, made by `scripts/trace_logo.py`); banner scenes; `fonts/` (source TTFs, OFL licences, `SOURCES.json`, README)

### design/prototype/

- `design/prototype/`: the approved hi-fi prototype (excluded from ESLint)

## Server modules

| Module | Responsibility |
| --- | --- |
| `env.ts` | `getEnv()`, `getSiteEnv()` (only `APP_URL` and `VERCEL_ENV`, validated on their own; in production a missing or invalid `APP_URL` throws, never a localhost fallback), `requireEnv(key)`, `EnvError`, `resetEnvForTests()` |
| `deps.ts` | `getDeps()` → `{ sms, email, payments, files, now }`; `setDepsForTests`, `resetDepsForTests`; re-exports `readOutbox` |
| `providers/` | `types.ts` (interfaces), `mock-sms.ts`, `mock-email.ts`, `outbox.ts` (`dev_outbox`), `fake-payments.ts`, `memory-files.ts`, `local-files.ts` (`FILE_STORE=local`, dev disk store), `blob-files.ts` (`FILE_STORE=blob`, private Vercel Blob; maps the SDK's already-exists error to `FileExistsError`), `file-store.ts` (`createFileStore`, the lazily resolved `getDeps().files`), `file-keys.ts` (`assertSafeKey`, `assertStoredType`, `FileExistsError`, `FileTooLargeError`, `DEFAULT_MAX_READ_BYTES`), `guard.ts` (`isMockForbidden`, `PRODUCTION_DB_NAME`) |
| `dev-only.ts` | `requireDevRoute()`: `notFound()` whenever mocks are forbidden |
| `http.ts` | `HttpError`, `jsonResponse` (`no-store`), `readJson` (16 KB cap, exact `application/json`), `withErrors` |
| `db/client.ts` | one cached `MongoClient` per process on `globalThis` (survives HMR, drops a failed connect); `getDb()` uses `MONGODB_DB` |
| `db/indexes.ts` | `registerIndexes(collection, specs)` (names mandatory), `ensureIndexes(db)` (creates missing indexes by name) |
| `db/register-all.ts` | imports every module that registers indexes, for `pnpm db:indexes` and int tests |
| `catalogue/` | `schema.ts` (zod), `pricing.ts` (`sellingPricePaise`, `percentOff`, and `cartTotals`: packs, MRP, discount, payable from each line's MRP; client-safe), `categories.ts`, `collections.ts`, `seed.ts`, `search.ts`, `queries.ts` (also `getPurchasableBySlugs`: a direct, never cached read of the active products in live categories, for cart pricing), `order.ts` (pure `compareVariants`, `orderForShelf`; client-safe) |
| `cart/rules.ts` | pure cart rules, client-safe and import-free: `CART_LIMITS` (10 per product, 20 per order), `CartLine`, `addLine`, `setLineQty`, `removeLine` (a refused or no-op change returns the same array; `product_limit` then `order_limit`), `capLines` (untrusted input to a valid cart, cut at 20 packs from the end) and `mergeLines` (max per slug, server order first, idempotent); lines are an array, so a slug like `__proto__` is ordinary |
| `cart/carts.ts` | the `carts` collection (`CartDoc`: one document per user, lines as an array plus `rev`, never a price), `readCart` and `mutateCart`: every write is a compare-and-set on `rev`, a no-op returns the same array and writes nothing, a missing cart inserts at `rev: 1` (E11000 retries), and 25 lost races, or a 2 s total deadline (`performance.now()`, with capped exponential jitter between tries), throw `HttpError(409, "cart_conflict")` |
| `cart/service.ts` | the priced cart: `getCart` (reprices from Mongo; retired lines are deleted in the same write and listed in `removed`; on 409 it falls back to the unpruned view), `addToCart`, `setCartQty`, `removeFromCart` (every change first drops retired lines, so a hidden product never counts toward a cap, and a refused change still writes the pruned cart; `CartResult` errors `product_not_found`, `product_limit`, `order_limit` leave the live cart untouched); `mergeGuestCart` (retired lines dropped on both sides before `mergeLines`, reports `trimmed`, writes nothing on a replay) and `quoteLines` (no write) |
| `auth/` | `identifier.ts`, `otp.ts`, `users.ts`, `sessions.ts`, `cookie.ts`, `login.ts` (`sendOtp`, `verifyOtpAndLogin`), `guards.ts` (`getAuth`, `requireUser`, `requireRole`, `sessionRefreshHeaders`: the `Set-Cookie` that re-issues the sliding customer cookie, which every customer route that calls `requireUser` merges into its response), `roles.ts` |
| `security/` | `rate-limit.ts` (`hitRateLimit`, `peekRateLimit`, `resetRateLimit`), `client-ip.ts` (`clientIp`, `ipBucket`), `origin.ts` (`assertSameOrigin`) |
| `audit.ts` | `appendAudit()`, the only writer of `audit_logs` |
| `orders/status.ts` | pure state machine: `ORDER_EDGES`, `transition()`, `initialStatus()` |
| `orders/order-number.ts` | `nextOrderNumber(now)`, `formatOrderNumber`, `orderMonthKey` |
| `prescriptions/file-check.ts` | `checkRxFile(bytes)`: magic-byte type (`sniffType`), 1 to 8 MiB; an image is re-encoded with sharp to WebP q85 (longest side 3000, shortest at least 400, 50 MP input cap, one frame, EXIF rotation applied, all metadata dropped, 5 s timeout); returns `{ ok, file }` or a named `RxFileError`, plus the sha256 of the stored body. PDFs are refused until the scan lands (part B) |
| `prescriptions/validity.ts` | `isRxValidOn(rx, at)`, `addCalendarMonthsIst`, `RX_VALIDITY_MONTHS = 6`, `istMidnight(ymd)` (a day's 00:00 IST instant; `RangeError` for a malformed or impossible date), `istDay(at)`, `rxEnd(rx)` (the exclusive end: `min(validUntil, rxDate + 6 months)`) |
| `prescriptions/review.ts` | pure: the status and reject-reason lists, the patient declaration text and version, `RxApproveInput` and `RxRejectInput`, and `reviewRx` (approve only from pending; reject from pending, or from approved as a revoke; a reject's `set` carries no dates, so an approved Rx keeps them; rejected is final; an unknown status is `invalid_transition`), `rxView` (the customer list item: under review, approved, expired or rejected, with IST days) |

## Collections and indexes

| Collection | `_id` | Indexes (name) | Written by |
| --- | --- | --- | --- |
| `products` | ObjectId | `slug_unique`, `category_active_sortOrder`, `familySlug_active` | seed |
| `categories` | ObjectId | `slug_unique` | seed |
| `rate_limits` | the limiter key | `expiresAt_ttl` | `hitRateLimit` |
| `otp_challenges` | `<channel>:<value>` (one live challenge per identifier) | `expiresAt_ttl` | `issueOtpChallenge`, `verifyOtpChallenge`, `checkOtpChallenge` (refunds a matching check's attempt) |
| `users` | ObjectId | `phone_unique`, `email_unique` (both partial) | `findOrCreateUserByIdentifier` (sign-up `name` and `consents` on insert only), `setUserRole`; lookups filter `{ $eq, $type: "string" }` so the partial indexes apply |
| `sessions` | SHA-256 of the token | `expiresAt_ttl`, `userId_1` | `createSession`, `resolveSession`, `revokeSession` |
| `carts` | the user's ObjectId | none | `mutateCart` (through `service.ts`) |
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

`getDeps()` builds once per process from env. If the SMS, email or payment provider is a mock
(`mock`, `fake`) and `isMockForbidden()` holds, it throws "Mock providers are not allowed in
production". The other real providers (`msg91`, `resend`, `razorpay`) are accepted by the env schema but
throw "not implemented yet" until the N and O phases build them.

`getDeps().files` (`providers/file-store.ts`, `createFileStore`) is resolved on **first use**, so a
mis-set `FILE_STORE` fails only file access, with an `EnvError` that names the cause, and never
OTP login or search. It refuses `memory` and the dev disk store `local` wherever mocks are
forbidden, and whenever `VERCEL_ENV` is set, because memory and disk files do not persist across
Vercel functions. `FILE_STORE=blob` needs `BLOB_READ_WRITE_TOKEN` (an `EnvError` on first use)
and imports `@vercel/blob` only then, so routes that never touch files never load the SDK.
Every `FileStore`:
- has a `kind`;
- checks keys with `assertSafeKey` (`^[a-z-]+(/[A-Za-z0-9_-]+)+(\.(webp|pdf))?$`) and content
  types with `assertStoredType` (`image/webp`, `application/pdf`, `application/octet-stream`);
- never overwrites: a put to an existing key throws `FileExistsError`. The Blob SDK retries puts
  internally, so a put that landed but lost its response comes back as `FileExistsError`: R4/R5
  treat it as success only after reading the key back and checking its SHA-256, or retry with a
  new id;
- throws `FileTooLargeError` past `get`'s `maxBytes`, which defaults to `DEFAULT_MAX_READ_BYTES`
  (8 MiB, the prescription cap).

Tests swap parts with `setDepsForTests({ now, sms, … })` and restore with `resetDepsForTests()`.

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
`catalogue/search.ts`, `catalogue/order.ts` and `cart/rules.ts`; anything else from there is a statement-level
`import type` (`src/components/server-imports.test.ts`). The server-only
`src/lib/catalogue/cached.ts` and `errors.ts` are exempt by name, and must never be imported by a
`"use client"` module (the test sees direct imports only); a new server-only `src/lib` file joins
that list.
