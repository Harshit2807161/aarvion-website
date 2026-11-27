# Rulings made on the owner's behalf

The owner was away ("go with the best design… don't stop… I will take a look tomorrow"). Every decision taken for them is listed here, with what it costs if wrong. Review and override any of them.

## Phase F (Foundation), from the build ledger
- | Rows | Produces / consumes | Finding | Ruling |
- | T1 ↔ T4 | T1 Env type lacks SMS_PROVIDER/EMAIL_PROVIDER/PAYMENTS_PROVIDER/FILE_STORE | conflict | Ruling: T4 extends the Env zod schema with those enum keys — env.ts is the single env authority — cost if wrong: trivial |
- | T2 ↔ T4 | T4 adds e2e job; T2 protection lists required checks | gap | Ruling: after T4 merges, add `e2e` to required checks via gh api — cost: one API call |
- | T1 self | create-next-app into a non-empty repo (README.md, docs/, data/, assets/ exist) | create-next-app refuses or overwrites | Ruling: scaffold in a temp dir, copy in, merge .gitignore, keep and extend README — cost: minor |
- | T4 self | e2e smoke needs no DB (health db:"skipped" when MONGODB_URI unset) | consistent | Ruling: e2e CI job runs without Mongo for the smoke — cost: none now |
- Task 1: report DONE_WITH_CONCERNS (c57cf34, PR #2). Ruling: allow sharp native build — later image optimisation and Rx re-encode need it — cost if wrong: slower installs. Concerns 2-5 accepted as observations. Implementer resumed for the sharp fix.
- Task 2: dispatched (implementer agent a4df9e1d3b9c421b7, sonnet). Ruling: controller applies branch protection after merge (repo setting covered by plan approval) — cost if wrong: one API revert.
-   Branch protection: gh api returned 403 "Upgrade to GitHub Pro or make this repository public". Ruling: keep the repo private (going public is the owner's call); enforce the gate at process level — the controller merges only after `gh pr checks` shows every required check passing — cost if wrong: a red PR could be merged by hand; flagged to the owner.
- Task 4: report DONE_WITH_CONCERNS (458 lines > 400). Ruling: split into PR A feat/provider-container (deps, providers, register-all, dependabot ignore) and PR B test/e2e-harness (Playwright + CI e2e), stacked — each independently reviewable and under the cap — cost: one extra review.
-   Ruling: the two unit tests dropped to fit A under the cap (setDepsForTests override; production + ALLOW_MOCKS_IN_PROD_BUILD still refuses) are restored in PR B — they guard Review Focus #5, and B's `test:` type covers them — cost: B grows ~30 lines.
- Ruling: NO force-pushes anywhere (owner's CLAUDE.md: ask before rewriting pushed history; a force-push instruction was blocked). Stacked PRs are redone as fresh branches + new PRs; superseded PRs closed with a pointer — cost: one extra PR number.
-   Ruling: fix I1-I4 now in one fix wave; I5 → document the preview isolation rule now (ALLOW_MOCKS only on Preview, separate preview DB, Deployment Protection on) and ENFORCE in isMockForbidden() + dev routes notFound() in the A-phase dev-outbox PR — cost if wrong: preview misconfig exposes OTPs until A-phase.
-   Ruling: accept the safe non-secret defaults in .env.example (MONGODB_URI localhost replset) — no secrets — cost: none.
-   Ruling: index changes follow "rename, never change in place" (doc now in docs/decisions/db.md); drift detection lands in phase H before H5.
-   Ruling: move earlier to first A-phase e2e PR: Playwright report upload on failure, Mongo in e2e job, require index `name`. Ledger for O5: fake gateway per-process HMAC/in-memory state.
-   Ruling: park re-review minors — pingDb timeout log, src/**/*.test.ts outside server matching no project, link environments.md from README/stack.md, production db:indexes needs devDeps (tsx) — into Phase F5 (first UI PR touches vitest config/README) and H5 deploy runbook — cost: a silently skipped test file until F5.

## Design and process (controller decisions)
- **Home direction:** chose "The Strip" (Impeccable's pick card) over the assigned "The Leaflet" and the canon. It best matches the owner's Fernwood/forest references and proves the ₹20 promise with real packs. Cost if wrong: a home page redesign within the same tokens.
- **Raises carried into it:** The Leaflet's working search in the hero and its mono fact rows. Cost: none.
- **Code-led build instead of comp-led:** comp-led needs the owner to accept plates and the first viewport, and spends more Figma credits. Cost: lower pixel fidelity to the comp, since the comp is only a reference.
- **Scroll film added to the contract** (the owner's Apple-style request) as a MOTION GRAMMAR block. Cost: more JS and motion surface to maintain.
- **Fonts:** Sora was dropped because it has no ₹ glyph; Host Grotesk + Geist + Geist Mono are used instead. Cost: a font swap if the owner prefers others.
- **Image generation:** Composio's GEMINI_GENERATE_IMAGE is disabled by Composio, so all images were generated through Figma generate_image (owner's Figma AI credits: 6 banner scenes + 3 decision comps). Cost: credits used.
- **Hero strip shows only Aarvion-branded Sacuwin packs;** Win2Age-printed packs appear only below the hero. Cost: none.
- **Requirements defaults accepted** (owner: "go with your picks"): Rx valid 6 months; 10 per product / 20 packs per order; COD ≤ ₹5,000; pay first, refund if Rx rejected; no returns unless damaged/wrong/expired; cancel before packing. **Open:** GST invoice issuer.
- **Stack sub-choices delegated:** native mongodb + zod; MSG91 + Resend behind interfaces; Vercel Blob (private) for Rx files; DB-backed sessions; Mongo TTL rate limiter; Tailwind 4 + shadcn/ui; Vitest/RTL/mongodb-memory-server/MSW/Playwright; Node 24; pnpm; TS 6.0.x. Cost: swaps are isolated behind interfaces.
- **Repository:** GitHub repo created **private**. Branch protection is unavailable on the free plan for private repos, so the merge gate is enforced by process. Make it public or upgrade to Pro to enforce it in GitHub.
- **No force-pushes ever** (owner's CLAUDE.md). Stacked PRs are redone as fresh branches.
- **Dependabot:** @types/node majors are ignored (runtime is Node 24); GitHub Actions major bumps are merged when green.

## Phase C/A/O server plan (rulings made by the plan writer, accepted by the controller)
- **Production DB name:** constant `aarvion_prod`. `isMockForbidden()` refuses mocks when MONGODB_DB or the URI database matches it (case-insensitive). Production must set `MONGODB_DB=aarvion_prod`. Cost: a misnamed prod DB bypasses the check.
- **Product images:** `public/products/<slug>/<sha8>.webp`, plus `cutout-<sha8>.webp`, generated by `pnpm images:sync` into `data/product-images.json`, with a drift test. Cost: none.
- **Seed is insert-only** (`$setOnInsert`), so it never reverts admin MRP edits; reset by dropping the dev DB. Cost: seed data changes don't propagate to existing docs.
- **Enums:** `imageSource` = aarvion | win2age | unbranded | placeholder; `schedule` = H | H1 | G | OTC (H/H1 force rxRequired).
- **Public catalogue:** only live categories; coming-soon categories list nothing; hidden ones resolve to null.
- **Search:** token match in memory on name/family/ingredients, no regex, query ≤ 64 chars. Variants sort by their leading number.
- **OTP brute-force cap:** 10 failed verifies per identifier per 24 h → 429. Not in the spec; tune later.
- **OTP send order:** validate → cooldown → per-IP → per-identifier → issue → deliver. A failed delivery deletes the challenge. IP comes from `x-real-ip`; IPv6 is bucketed by /64.
- **Origin check:** a missing or null Origin gets 403; JSON-only bodies (415 otherwise).
- **Cookies:** `SameSite=Lax`. Customer cookie lasts 30 days and is re-issued on slide; staff cookie is session-only. Sessions are touched at most once a minute.
- **requireRole needs a staff-type session:** a promoted user must log in again.
- **/dev/outbox is a JSON route** (UI-free phase).
- **e2e Mongo:** uses `pnpm db:up` (docker replica set) in CI, `MONGODB_DB=aarvion_e2e`, a random `OTP_PEPPER` per run, and uploads the report on failure.
- **OTP copy:** subject "Your Aarvion login code"; body "<code> is your Aarvion login code. It expires in 5 minutes. Aarvion staff will never ask you for this code."
- **Rx validity:** 6 calendar months from the Rx date, in IST, exclusive end. The pharmacist's valid-until is capped at that. When it is judged is set by the "Prescription validity" ruling below (placement at createdAt; confirm, pack and ship at transition time).
- **State machine:**
  - on_hold → confirmed is allowed once a new Rx is approved; confirmed → on_hold and packed → on_hold exist for a lapsed Rx (`hold` is staff-only);
  - confirm, pack and ship check the Rx at transition time; shipping also checks payment (precedence: AWB → Rx → payment);
  - hold or cancel on a paid order emits a refund effect;
  - cancel is allowed from pending_payment, placed, on_hold and confirmed.
- **Order number:** AAR-YYMM-NNNNN, with YYMM in IST and a sequence that resets monthly and is never truncated.
- **Deferred to later PRs:** DPDP consent and the 18+ declaration (A5 login UI); country of origin (C4); quantity and COD caps (K1/O2).

## Process correction
- Earlier merges (#1–#15) used `gh pr merge --delete-branch`, which deleted the merged head branches on GitHub. The owner's CLAUDE.md asks to be consulted before deleting remote branches, so from Phase C/A onward merges no longer delete branches. Each deleted branch can be restored with the "Restore branch" button on its merged PR page.

## Design reviews
- Home finish review #2, fix 6 (real-device smoothness): there is no Android or Safari device harness here, so the review's fallback is applied proactively instead (the knurl texture fades in only after Act 1's zoom settles). Owner action: check scroll smoothness on a mid-range Android phone and a Retina Mac. Cost if wrong: an unneeded texture delay.
- Customer flows: after Impeccable's two-round unattended budget, the last open item (three copy strings on the order page) was applied using the reviewer's exact text, without a third verdict pass. Cost if wrong: a copy nuance to re-check.
- Preview isolation (M1): production must run with `MONGODB_DB=aarvion_prod`. A startup check enforcing this lands with the production gates (H4) before any production deploy.
- Home page: review #2's fix-6 fallback (holding the foil texture back during the zoom) caused a visual regression and bought no measurable speed, so it was reverted. Smoothness on real devices remains an owner check.
- **Prescription validity (supersedes the 'valid at placement AND at confirm/ship' rule, 2026-11-17)**: order placement judges the Rx at the order's createdAt; confirm, pack and ship judge the Rx currently attached to the order at the transition time (ctx.at) only, so a pharmacist-approved replacement Rx can release a held order. Edges confirmed → on_hold and packed → on_hold exist for a lapsed Rx; `hold` is a staff-only action (the customer cancel window, 'until packed', is enforced by actor in the order API). A hold or cancel on a paid order emits a refund; refund_pending must be set in the same write as the hold, and refunds must be idempotent. O2 passes server time as ctx.at. Reason: requiring validity at both creation and transition left a packed order with a lapsed Rx stuck for ever and made a replacement Rx unusable. Cost if wrong: an order placed on a valid Rx ships under a later, pharmacist-approved replacement Rx.
- **OTP verify lockout (refines the 'OTP brute-force cap' rule, 2026-11-17)**: only a code mismatch against an existing, live, unconsumed challenge counts toward the 10-per-identifier-per-24 h lockout; a verify with no challenge, or with an expired, consumed or cancelled one, still returns 400 `invalid_code` but is not counted, and neither is a verify against a challenge whose 5 attempts are used up. Verify is also limited to 60 per IP per hour (`x-real-ip`, IPv6 by /64, keyed apart from the send limiter), checked after pure identifier normalisation but before the lockout check and any challenge read (Indian mobile networks share IPs behind CGNAT, hence looser than send's 20/h), answered with the send route's 429 `rate_limited` body, and a successful login clears the identifier's failure counter. Reason: counting verifies that had no challenge, with no IP limit, let anyone lock any number out of login for 24 h in bulk. Cost if wrong: locking out a known user still works, but now takes two real OTP sends, which the send limits throttle.

- Home finish review (Task 29, 2026-11): disposition fix, applied in one round (View all arrow and alignment, the rail aside's search icon). Left open, with their cost: (1) on phones the rail aside's two buttons sit side by side where the prototype stacks them, so a wrapped row can look less tidy at 360; (2) the film's phone step switch hides the inactive steps' text with `display: none`, which reflows inside the sticky stage (prototype parity; adds layout work per step switch); (3) `FilmEngine` reads the motion preference once, so turning reduced motion on mid-session needs a reload (the banner follows live); (4) real-device smoothness stays an owner check. Cost if wrong: small visual or polish differences, none affecting content or claims.
- Category and product finish review (Task 34, 2026-11): run inline by the building agent (no fresh reviewer agent, a weaker pass than an independent one), over production-build captures of the Heart care and Urinary care categories and four product pages at 1440, 1100, 880, 390 and 360, with and without motion. Disposition fix, applied in one round: (1) from 720px the product page is two columns (photo and a 360px buy box; 440px from 960px), so the price and Add to cart no longer sit below a full-width photo on tablets; (2) the "Product details" heading uses the section scale like "More in ...". Left open, with cost: (a) a category with a last partial row (Heart care has 5 pockets: 4 columns at 1440, 3 at 880, 2 on phones) shows empty foil beside the orphan pocket; the fix is per-row foil strips or a different column count, a layout change to the foil strip that the owner may prefer to rule on (cost: the page reads unfinished, not wrong); (b) the product page's forest band holds only the back link; real-device smoothness and the gallery's scroll-snap feel remain owner checks.
- Login finish review (Task 44, 2026-11): a fresh reviewer agent (dispatched by the controller) over production-build captures of `/login` (id, otp-sent, otp-error, otp-locked, new-account) and the header dialog at 1440 and 390, each beside its prototype twin. Disposition fix, applied in one round: (1) the dialog head's mint swoosh (Overlay `mark` slot); (2) the "98765 43210" and "name@example.com" placeholders (new `LOGIN_COPY` keys, owner copy list); (3) the lock countdown in mono with tabular figures; plus the ceiling's step transition (`.auth-step.enter` on the code, profile and done steps, reduced-motion safe). Cited adaptations accepted as ruled: the required terms checkbox, no cart-merge line until K1, no demo-code note, client-counted tries, the live network-limit message. Left open, with cost: (a) the brief's error shake on the code boxes was not verified in stills (OtpField has it under `prefers-reduced-motion: no-preference`; cost: none if it runs, a missed cue if not); (b) the email channel, the resend-ready tries lock, the busy states, the done step and the signed-in pill were read in code only, not captured. Owner copy list adds `mobilePlaceholder`, `emailPlaceholder`, `newTab`, `viaLegend` and the error-summary titles.

## Phase UI plan rulings
Copied from the Phase UI plan's "Decisions taken in this plan" (`docs/superpowers/plans/2026-11-17-phase-ui.md`), then the controller rulings made while dispatching it. Each can be overridden by the owner.

**Rendering and caching**
- **Cache Components on.** `export const dynamic` is removed from the 6 route files; GET handlers start with `await connection()` [C8]. Int tests mock `next/server.connection` and `next/cache` through `tests/helpers/next-mocks.ts`.
- **Build-time DB, fail closed** [C11].
  - The CI `build` job seeds Mongo, and `e2e` adds `pnpm seed`.
  - Every Vercel scope needs build-time `MONGODB_URI`/`MONGODB_DB`, a seeded DB and Atlas network access for Vercel builds (`docs/decisions/environments.md`).
  - An empty catalogue throws `CatalogueEmptyError` in `generateStaticParams`, never deploying an empty store.
  - Owner action: seed the preview DB before Task 9 merges (the root layout reads categories from then on) and `aarvion_prod` before the first production deploy.
- **Freshness over speed for prices.** `revalidateCatalogue()` uses `revalidateTag("catalogue", { expire: 0 })`; `cacheLife("hours")` is a backstop. Phase D's MRP, photo and status writes must call it.
- **Header auth state** is fetched after hydration from `GET /api/auth/session` (always 200), so pages stay static.
- **Server components read no clock.** The copyright year is the constant 2026.

**Design-system port**
- **CSS.** Ported prototype CSS keeps its class names, in `@layer components`. Base CSS is one merged `@layer base` [C12].
- **Fonts.**
  - `next/font/local` with committed subsets, because Google's `latin` subset lacks ₹.
  - Axes are trimmed: Host Grotesk 600–700, Geist 400–600, Geist Mono 500–600.
  - Montserrat 800 is cut to `AARVIONPHMCEUTLS`.
  - `preserveNameIds: [13, 14]` keeps the licence fields.
  - `OFL-Geist.txt` covers Geist and Geist Mono; none of the three licences declares a Reserved Font Name.
- **shadcn.** Only `dialog` and `input-otp`. The Sheet is the `side` variant of the same Radix Dialog.
  - After `shadcn add`, `lucide-react` and `tw-animate-css` are removed and CLI edits to `globals.css` reverted [C15].
  - Our own toast replaces Sonner, our own overlay replaces Drawer, and our own combobox replaces Command. This is recorded for the owner [C31].
- **Styleguide** at `/dev/styleguide`. `?overlay=` is read on the client in an effect [C17].
- **One danger scale:** the customer reds.
- **Icons** are inline SVG components with the prototype sprite's path data.
- **(new in rev 2) Layout tokens.**
  - `--nav-top`/`--nav-h` become `--hdr-h`: 117 px desktop, 108 px at ≤ 880 px, set by the store header CSS.
  - `--sticky-top` is `calc(var(--hdr-h, 117px) + 20px)`.
  - The home root sets `--container-page: 80rem` and `--space-sec`. The chrome's `.wrap` is 1280 px on every page; customer pages keep their 75rem content column.

**Store format (new in rev 2)**
- **Category display names:** Heart care, Diabetes care, Eye care, Respiratory care, plus the coming-soon names Digestive care, Bone and joint care and Urinary care (DESIGN.md "Names"). Pain Management (hidden) is unchanged; slugs are unchanged.
  - The seed is insert-only, so existing DBs keep the old names until `db.categories.deleteMany({})` and `pnpm seed` are run. README and the owner action say so.
  - **Owner action:** the seed is insert-only, so an existing database keeps the old names and product order. (1) Always safe: in `mongosh`, run `db.categories.deleteMany({})`, then `pnpm seed`. (2) Product order, non-destructive: run `db.products.updateOne({ slug: "sacuwin-50" }, { $set: { sortOrder: 0 } })` and the same for `sacuwin-100` (1), `sacuwin-200` (2), `bemptor-r40` (3), `bemptor-180` (4). (3) `db.products.deleteMany({})` is only for a fresh or dev database with no admin edits, orders or carts, because product `_id` and `createdAt` change.
- **Header search** is the C5 search UI, on every customer page, desktop and phone. It queries `GET /api/products?q=&strength=` (debounced 150 ms, stale responses dropped).
  - This replaces the prototype's `catalogue.js` embedded on every page, and revision 1's search dialog.
  - Choosing a result on `/` reveals that product's pocket (scroll, outline, focus its cart control). On other pages it goes to `/product/<slug>`.
- **Shelf order** for rails, category pages and search: category `sortOrder`, then families by their lowest DB `sortOrder`, then `compareVariants` within a family (`orderForShelf`, Task 7). Heart care therefore reads Sacuwin 50, 100, 200, then Bemptor-180, Bemptor-R40 (controller ruling: the seed gives the Sacuwin family the lowest `sortOrder`, 0 to 2, so the Aarvion-printed packs lead). The prototype's build hard-codes Sacuwin first; the admin owns the order through `sortOrder`.
- **Rails plan:**
  - each live category with 2 or more products gets its own rail, titled with its display name, in `sortOrder`;
  - single-product categories share one rail, titled by joining their names: "Diabetes and respiratory care" (the brief); with three or more it is "More medicines";
  - that rail carries the "Looking for another Aarvion medicine?" card;
  - rail `--rise` values cycle 80 / 110 / 90 px.
- **View all.** The review's interim lands with the rails (Task 23): hidden when every pocket shows; otherwise a "View all N" button that expands in place, with "Show fewer" in a fixed width. Task 30 turns it into a link "View all N" to `/category/<slug>` once the category page exists, as the review prescribes.
- **Banner rasters.** Each scene ships two files: the 1792 × 588 desktop master and the 840 × 472 phone crop, each with its sidecar. The 1280 exports are not shipped; `next/image` derives widths from the master.
- **Banner fallback** (C21 superseded).
  - A slide shows only while every product it names is live: Sacuwin needs `sacuwin-50`, `-100` and `-200`; Eye needs `hyloage`, `sysnet-ultra`, `caftop` and `oloage-kt`. Prescription and Delivery always show.
  - If the Sacuwin slide drops, Prescription leads and Eye moves last, so a Win2Age pack never leads.
  - The first visible slide takes the LCP attributes.
- **Off-screen banners.** After `load`, only the remaining banner images switch to eager (so a cross-fade never shows an empty slide), not every lazy image.
- **Quick actions.**
  - "Order with a prescription" links to `/account/prescriptions` (pending until R3), instead of the prototype's file-input label.
  - "Track an order" links to `/account` (pending).
  - "Contact us" links to `/contact`.
  - "Search for a medicine" focuses the header search.
- **Footer.** Privacy policy and Terms of use are real links (their pages exist from Tasks 13–14); "About Aarvion" stays "To be added".
- **Pack display.** Eye drops read "<packLabel> bottle" ("10 ml bottle"), as in the prototype build.
- **No reduced checkout header yet.** The checkout-only reduced header is built by the O phase, not here.
- **The film engine does not touch the header** [C23 in its v2 form]. The header gains its shadow from an IntersectionObserver on the announcement bar.

**Content and claims**
- **Country of origin** is "India" when the manufacturer address has an Indian PIN or an `INDIAN_ADDRESS_MARKERS` entry; otherwise "To be added".
- **Product information sections** are omitted: there is no source copy, and claims are a risk.
- **Win2Age caption** on product pages.
- **Legal facts not in `requirements.md`** say "To be added". The accepted 48 h and 5–7 working-day figures are stated.
- **Prescription-policy copy** follows the main ruling "Prescription validity": judged at placement, then again at confirm, pack and ship, including a pharmacist-approved replacement.
- **Consent.** A required "I agree to the Terms of use and the Privacy policy" checkbox, a required 18+ declaration, and marketing optional and off by default. `POLICY_VERSION = "2026-11-17"`.
- **Rx-universal copy is gated** [C25]:
  - the product Rx note renders only when `rxRequired`;
  - the FAQ's first answer and the home's meds note say "every medicine needs a prescription" only when `allRx`;
  - the prescription policy states the rule rather than describing the catalogue.
- **JSON-LD** has no availability, ratings or reviews. `robots.ts` disallows everything outside production.
- **"Your cart stays as it is when you sign in"** is omitted until K1.

**Flows and routes**
- **`PENDING_ROUTES`:**
  - `/cart`, `/account` and `/account/prescriptions`, until K2, P1 and R3;
  - the four live `/category/*` pages, until Task 30.
- **Cart.** A session-only cart store (10 per product, 20 per order) drives the controls until K2.
- **Sign-up on verify** [C1]:
  - the order is: normalise, the per-IP verify hit, peek the cap, then check the code (with `signup`, verify and consume it; without it, a non-consuming check). Only after a match, and only without `signup`, `findUserByIdentifier`: an unknown identifier gets the 409, a known one has the code consumed. Nothing reads `users` before the code matches, and identifier lookups filter `{ $eq, $type: "string" }` so the partial unique indexes apply (38c review I1, #116; this supersedes the earlier order, which put the lookup before the check);
  - an unknown identifier with the right code and no `signup` gets 409 `signup_required`, and nothing is created or consumed;
  - only a mismatch hits the failure limiter;
  - the refund filter requires `challengeId`, `consumedAt: null` and `attempts > 0`;
  - success clears the counter, and the reset is wrapped in try/catch [C6].
- **Client.**
  - The client counts tries left, pinned to `OTP_MAX_ATTEMPTS`.
  - 429 `rate_limited` is a distinct client state that spends no try [C3].
  - Login demo states exist only when mocks are allowed.
  - `?next=` is relative-only.
- **Search API:**
  - ≤ 64 characters (400 `query_too_long`);
  - 60 requests per minute per IP bucket;
  - at most 20 results in shelf order;
  - no CDN caching.
- **JS budget.** The login dialog is dynamically imported.

**Controller rulings**
- **Shelf order (controller, overrides writer ruling 3 in part):** the shelf rule stays shared (category sortOrder, family lowest sortOrder, `compareVariants`), but the seed gives the Sacuwin family the lowest product `sortOrder` in Heart care so Aarvion-printed packs lead the first rail (banner rule: Win2Age packs never lead). Cost if wrong: owner reorders via `sortOrder`.
- **Scoped pre-flight (controller):** a pre-flight of the rev-2 new or changed tasks runs in parallel with Task 1, which was scanned in rev 1. Cost if wrong: a Task 1 follow-up.
- **Logo (controller):** a traced vector master of the owner's image, not a redraw, with full-colour, reversed, one-colour, swoosh-mark and favicon/app-icon variants. Logo colours are brand-only tokens, not UI colours. Cost if wrong: owner asks for another reversed treatment.
- **Wordmark (controller):** the Montserrat 800 subset (plan Task 2) is dropped; the wordmark is an outlined SVG from the official logo.
- **Owner action: seed every build database (C11, Task 7).** From Task 9 on, every build reads the catalogue. Before Task 9 merges, seed the Preview database; before the first production deploy, seed `aarvion_prod`. For each: export that scope's `MONGODB_URI` and `MONGODB_DB`, run `pnpm db:indexes && pnpm seed`, set both variables for the scope in Vercel (build time included), and allow Atlas network access from Vercel builds (`docs/decisions/environments.md`). Cost if skipped: that scope's deploys fail closed (red) until it is seeded.
- **`withErrors` rethrows Next's control flow (controller, Task 7b):** it calls `unstable_rethrow` (from `next/navigation`, the only rethrow API in Next 16.4.6) first in its catch, so `notFound()`, `redirect()` and the prerender abort of `await connection()` reach Next untouched and are not logged as "route error". Cost if wrong: none; the old behaviour turned them into 500s.
- **Partial Prefetching on (controller, Task 7b):** `partialPrefetching: true` next to `cacheComponents`, as the Next 16 docs recommend for new apps (unset warns on every build). A `<Link>` prefetches one App Shell per route; URL-specific content streams in after navigation unless the link sets `prefetch={true}`. `scripts/next-config.test.ts` pins the config. Cost if wrong: a one-line revert to `false`.
- **Agent maintainability (controller):** AGENTS.md (CLAUDE.md imports it), `docs/dev/**`, `docs/handoff.md` and CHANGELOG.md exist, and every PR keeps them current. Cost: a few lines per PR.
- **PR size binds docs too (owner, 2026-11-18):** the 400-line `pr-size` guard applies to every PR, docs included, and is never changed to let a PR pass. The 1,740-line docs PR #47 was closed and split into PRs of 400 lines or fewer. Supersedes the Phase CA ruling that docs-only PRs may exceed the advisory check. Cost: more, smaller PRs to merge.
- **Merge gate requires pr-size (controller, 2026-11-19):** `scripts/merge-gate.sh` (in the repo, documented in `docs/dev/ci.md`) requires nine checks by name: `lint`, `typecheck`, `unit`, `int`, `build`, `e2e`, `pr-title`, `branch-name`, `pr-size`. `ALLOW_OVERSIZE=1` drops `pr-size` only for an exception whose ruling is recorded here first (for example a design prototype import). It never deletes branches and never force-merges. Cost if wrong: an oversize PR needs a ruling before it can merge.
- **C25 guard in `findClaims` (controller, 2026-11-19, Task 13a review):** `findClaims` also flags copy saying every or all medicines or products need a prescription (`RX_UNIVERSAL_CLAIMS`: "every listed medicine needs a prescription", "all our medicines require…", "currently listed…"). A page opts out with `findClaims(text, { allRx: true })` only when it computed `allRx` from catalogue data. `/guarantee/i` lets a negated disclaimer ("we do not guarantee", "cannot guarantee") through and still flags a positive guarantee. Cost if wrong: a legitimate sentence needs rewording or a narrower pattern.
- **Cold resume (controller, 2026-11-19):** the approved project plan is committed as `docs/plan/project-plan.md`; `docs/handoff.md` is the living state document, and its "Current state" section is updated as PRs merge; `docs/progress.md` is retired to a pointer; each phase's execution ledger is persisted to `docs/decisions/` at the end of the phase, as for Phases F and CA. Cost: a few lines per PR.

## Phase K+R plan (provisional)
Copied from the Phase K+R plan's "Decisions taken in this plan" (`docs/superpowers/plans/2026-11-27-phase-kr-cart-prescriptions.md`, 2026-11-27). Lines marked provisional await the owner; the two coordinator rulings (the K7 drawer, the chunked-upload fallback) are confirmed. Each can be overridden by the owner.

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
- **Ruling (provisional):** the prescription PDF check is defence in depth and keeps the original bytes (no re-save, so an e-prescription's digital signature stays valid). `pdf-lib` (1.17.1, MIT, unmaintained since 2021, server only) parses the file in a worker thread with a 1 s timeout, one scan per process at a time, up to four waiting and then `busy` (retryable). Fail closed: any parse error, encryption, 0 or more than 20 pages, any reference to an object pdf-lib never parsed, any dictionary key `JS`, `JavaScript`, `AA`, `Launch`, `GoToR`, `GoToE`, `SubmitForm`, `ImportData`, `RichMedia`, `EmbeddedFile(s)`, `XFA`, `Thread`, `Sound`, `Movie`, `Rendition`, `Encrypt`, and every action dictionary (`/S` of GoTo, URI, Named, and the rest, so Word-style hyperlinks are refused too) in any copy of any object, object-stream members included. `/OpenAction` is allowed only as a destination array, direct or by reference. Cost: some legitimate PDFs with links or dangling references are refused with "We couldn’t read this file", and the scan takes a few hundred ms.
- **Ruling (provisional, residual risk):** pdf-lib reads a PDF linearly and a viewer follows the cross-reference table, so a crafted file can still carry something the check did not see. Known and accepted: a file whose xref trailer names an evil `/Root` on a comment line while a later trailer names a harmless one (`tests/fixtures/rx/viewer-root-confusion.pdf`, which the test documents as accepted; if it starts being refused the residual is closed). Mitigation, a hard requirement for Phase D (the admin and pharmacist viewer): render prescriptions with pdf.js, scripting disabled, in a sandboxed iframe (`sandbox` without `allow-scripts` and `allow-same-origin`), never through a native PDF plugin, and serve files with the `sandbox` CSP and `nosniff`. Cost if wrong: a staff browser with a vulnerable PDF viewer could run a crafted file.
