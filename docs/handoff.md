# Handoff

The living state document for whoever takes over the Aarvion storefront, agent or human. Read
[AGENTS.md](../AGENTS.md) first, then this page. **Every PR that merges, opens a phase or clears
an owner action updates "Current state" in the same PR**, so this page stays the one place that
says where the build is.

Repo: `Harshit2807161/aarvion-website` (public since 2026-11-19). Owner: Aarvion Pharmaceuticals, New Delhi. The
owner delegated design and build decisions and authorised the build controller to merge green
PRs ([project plan](plan/project-plan.md), Context, point 3); every ruling made for them is in
[decisions/rulings.md](decisions/rulings.md) for review. History by PR: [CHANGELOG.md](../CHANGELOG.md).

## Current state

**As of 2026-11-28, `main` is at `b5cd2f5` (#197).** The UI phase (44 tasks) is complete and
reviewed. Phase K+R (server cart and prescriptions) is in progress. Nothing is deployed.

What a visitor sees on a local build: the store chrome (announcement bar, header with search,
sign-in dialog and cart pill, category bar, footer); a complete home page (hero banner, quick
actions, trust strip, "Shop by category" bento, product rails, How ordering works with the
scroll film, FAQ, the close); category pages (`/category/<slug>`, with coming-soon and 404
cases); product pages (`/product/<slug>`: gallery, buy box, strength switcher, facts, JSON-LD);
header search; the sign-in dialog and `/login` (OTP by email or phone, sign-up with consent);
the policy pages (`/legal/{privacy,terms,returns-cancellation,shipping,prescription-policy,
grievance}`) and `/contact`; `/sitemap.xml` and `/robots.txt`; 404 and error pages. Cart
controls work on a session-only cart (a server cart is being built, below). `/cart`, `/account`
and `/account/prescriptions` still 404 (`PENDING_ROUTES`): see "Deploy blockers".

Routes on `main`:
- Pages: `/`, `/category/[slug]`, `/product/[slug]`, `/login`, `/contact`, `/legal/*`,
  `/sitemap.xml`, `/robots.txt`, and the dev-only `/dev/styleguide`.
- APIs: `GET /api/health`, `POST /api/auth/otp/send`, `POST /api/auth/otp/verify`,
  `GET /api/auth/me`, `GET /api/auth/session`, `POST /api/auth/logout`, `GET /api/products`
  (search).
- Dev only (a real 404 in production, decided in `src/proxy.ts`): `GET /dev/outbox`,
  `/dev/styleguide`, `/dev/catalogue/revalidate`.

Collections: [architecture.md](dev/architecture.md#collections-and-indexes).

### Merged

| Phase | PRs | What exists |
| --- | --- | --- |
| Stages 0–3: data, requirements, design | #1, #37, #43 | catalogue docs and seed data; requirements v0.1 (owner accepted the defaults); `DESIGN.md`; the hi-fi prototype (store v2 approved by the owner on 2026-11-18) |
| F Foundation | #2–#14 | Next.js app, env loader, health route, CI and PR guards, Mongo client and index registry, provider container with mocks, Playwright harness |
| C Catalogue | #16–#20 | schemas, pricing, hashed images, insert-only seed, queries and search |
| A Auth | #21–#40 | rate limiter, OTP send and verify, sessions, guards, `/api/auth/me`, logout, audit log, preview isolation, `/dev/outbox`, auth e2e |
| O1 order domain | #35, #36, #38, #39 | Rx validity, pure order state machine, order numbers |
| Agent docs and merge gate | #49–#66, #86 | AGENTS.md, CLAUDE.md, `docs/dev/`, CHANGELOG, `scripts/merge-gate.sh`, the project plan |
| **UI phase (complete)** | #45–#192 (44 tasks) | tokens, fonts, icons, base and form components, overlay, toast and live region; cached tagged catalogue reads; shell (header, category bar, footer, 404 and error pages, policies); cart store, controls and pill (session-only); the whole home with the scroll film; category and product pages with SEO; header search; login, sign-up and the sign-in dialog; the official logo. Execution ledger: [decisions/phase-ui-ledger.md](decisions/phase-ui-ledger.md); rulings: [decisions/rulings.md](decisions/rulings.md) ("Phase UI") |
| K+R, merged so far | #179, #181, #184, #185, #186, #187, #189, #180, #182, #191, #194, #195, #197 | pure cart rules and totals, the compare-and-set cart store and priced cart service; IST date helpers, review transitions and the list view for prescriptions; image validation and re-encode; local and private Vercel Blob file stores; `sessionRefreshHeaders`; the exported `PersonName` rule |

### In flight

Phase K+R: [superpowers/plans/2026-11-27-phase-kr-cart-prescriptions.md](superpowers/plans/2026-11-27-phase-kr-cart-prescriptions.md)
(15 tasks K1–K7, R1–R7, the KR8 gate; provisional rulings in `decisions/rulings.md`). K1 (cart
API) and R1–R3 are largely on `main`; K2 onward (shared cart store, drawer, `/cart`) and R4
onward (review service, upload routes, `/account/prescriptions`) are not.

Open PRs on 2026-11-28:
- Phase K+R: #193 (R2, PDF check), #198 (R4, prescription records and staging slots), #199 (K1,
  guest merge and the no-write quote).
- Phase-end review fixes for the UI phase: #196 (search Enter never opens an earlier query's
  result), #200 (add-to-cart e2e), #201 (ordering steps: refund copy gated on `onlinePayments`,
  phone spacing), #202 (UI ledger and rulings persisted), and this handoff refresh with the docs
  fixes.

Phase O (orders and payments) has a plan, not started:
[superpowers/plans/2026-11-28-phase-o-orders-payments.md](superpowers/plans/2026-11-28-phase-o-orders-payments.md)
(21 tasks O1–O21; its provisional rulings are in `decisions/rulings.md`, "Phase O plan"). Its wave 1
(O1 order rules, O3 address book, O4 gateway contract and fake) is pure or server-only and can
run beside K4–K7 and R5–R7.

The controller keeps a per-phase execution ledger in the gitignored `.superpowers/sdd/<plan>/`
of its build checkout. **At the end of each phase it is persisted to `docs/decisions/`**
(`phase-f-ledger.md`, `phase-ca-ledger.md`, `phase-ui-ledger.md`), and its rulings are copied
into `docs/decisions/rulings.md`.

### Deploy blockers

Everything here must be true before the first production deploy. The H4 gate (see
[deploy.md](dev/deploy.md#production-gates-phase-h-planned)) is meant to check as many as can
be checked in code.

1. **No real providers.** `msg91`, `resend` and `razorpay` are accepted by the env schema but
   throw "not implemented yet", and mocks are refused in production, so nobody can sign in. Built
   in N and O.
2. **Legal facts are "To be added"** (drug licence numbers, registered pharmacist, grievance
   officer, GSTIN, customer care, data storage and retention, liability and governing law).
   `assertLegalConfigComplete()` (H4) covers `SITE_CONFIG` only, not page copy (owner actions 7,
   23, 24).
3. **Startup assertions are not written:** `VERCEL_ENV=production` must imply
   `MONGODB_DB=aarvion_prod`; `APP_URL` must be set to an `https` URL that is not localhost
   (H4).
4. **No security headers** (`next.config.ts`): no CSP, `frame-ancestors 'none'` (so `/login`
   cannot be framed), `nosniff` or HSTS. Phase H.
5. **The database must be seeded** (`pnpm db:indexes && pnpm seed`) in every Vercel scope before
   a build: every build reads the catalogue (owner action 5).
6. **Cart, account, prescription upload and order tracking are not built, and there is no
   sign-out.** `/cart`, `/account` and `/account/prescriptions` are in `PENDING_ROUTES`: the
   header cart pill and Upload prescription link, the quick actions, the close, the footer and
   the privacy page all link to them and 404, and order tracking (part of `/account`, P) does not exist. Since #173 a real
   sign-in exists, but no UI calls `POST /api/auth/logout`, so a shopper on a shared device has
   a 30-day sliding session, no way to end it and an Account button that 404s. Built in K2, R
   and P (put a Sign out action in the account pill menu or `/account`); the H4 gate must refuse
   a production build while `PENDING_ROUTES` is non-empty.
7. **Online payments stay hidden** while `SITE_CONFIG.onlinePayments` is false (no UPI or card
   claims; the ordering steps, FAQ, footer, trust strip and Terms already branch on it). Flip it
   only with live Razorpay keys.
8. **Repo hygiene before launch:** the provenance sidecars in `public/**/*.json` and the
   "Where everything lives" table below name the owner's Figma file key (access still needs
   Figma permission): move or redact; decide log retention for the search `q` parameter (it
   travels in the URL).
9. **Watch after launch:** search, `/api/products` and OTP send are rate limited per IPv4;
   mobile carrier NAT can put many shoppers behind one address, so watch the 429 rate.

UI plan tasks: all 44 are merged; see the ledger for the per-task record.

### Open owner actions and blockers

| # | Item | Why it matters | Blocks |
| --- | --- | --- | --- |
| 1 | **Reseed existing databases after #51:** follow README "Reseeding after the category rename" in each database seeded before #51 (local dev, and any preview): `db.categories.deleteMany({})` then `pnpm seed`, then the per-slug `updateOne` of product `sortOrder`. Never `db.products.deleteMany({})` outside a fresh or local database with no admin edits, orders or carts | the seed is insert-only, so old names and Bemptor-first order stay | correct category names and shelf order |
| 2 | A domain | email OTP and notifications need a verified sender | email in production (N) |
| 3 | DLT registration with MSG91 (sender ID + 6 SMS templates) | required by Indian law for any SMS; takes days | SMS OTP and order SMS (N) |
| 4 | Vercel Pro team, linked to GitHub | Hobby is non-commercial | previews and deploy |
| 5 | MongoDB Atlas, Mumbai; then seed each Vercel database with `pnpm db:indexes && pnpm seed` (**Preview first**, since the `(store)` layout reads the catalogue for the footer; `aarvion_prod` before the first deploy) | every build reads the catalogue (the footer's categories), so an unseeded scope fails closed | previews and deploy |
| 6 | Razorpay test keys (by the O phase), then KYC and live keys | online payments | prepaid checkout |
| 7 | Drug licence numbers, registered pharmacist, grievance officer, GSTIN, customer care details | legal display on footer, contact and policies; Razorpay KYC; the H4 gate | launch |
| 8 | Who issues the GST invoice (Aarvion or a dispensing partner), HSN codes and GST rates | invoices | order invoices (O) |
| 9 | Legal confirmation for selling Schedule H medicines online (retail licence or licensed dispensing partner, registered pharmacist) | compliance | launch |
| 10 | Check scroll film and banner carousel smoothness on a mid-range Android phone and a Retina Mac | no device harness here | home finish |
| 11 | A larger Sacuwin 100 photo | asked for by home review #2 (the 2× flyer) | design polish |
| 12 | Confirm Bemptor-R40's MRP (read ₹630; OCR said ₹650) | price correctness | then [change-an-mrp](dev/runbooks/change-an-mrp.md) if wrong |
| 13 | Hyloage and Sysnet Ultra manufacturer names (unreadable on the photos) | Legal Metrology declaration on product pages | product pages |
| 14 | Confirm Mucohelp is the right product (probable match; only back and side panels) | catalogue accuracy | — |
| 15 | Aarvion-branded photos for the 8 placeholder products; photos for the 20 missing products and Vildage-M 50/1000 | Win2Age swap; catalogue growth | [swap](dev/runbooks/swap-a-product-photo.md), [add](dev/runbooks/add-a-product.md) |
| 16 | ~~Branch protection~~ Done 2026-11-19: the repo is public and protection is applied (see [decisions/repo.md](decisions/repo.md)) | — | — |
| 17 | Deleted-branch disclosure: merges #1–#15 used `gh pr merge --delete-branch`, deleting those head branches without asking. Merges since do not delete. Restore any with "Restore branch" on its PR page if wanted | owner's rule on remote branches | — |
| 18 | Approve the banner composites explicitly: the store v2 prototype was approved on 2026-11-18, but the Eye slide shows Win2Age packs | banners are live on the home page | — |
| 19 | Review the official logo now in `public/brand/` (#67; it replaced the redrawn draft and the "outlined wordmark" input) | brand use everywhere | header and footer |
| 20 | Legally reviewed product information copy (uses, storage, precautions) | sections are omitted until then (no claims) | product pages |
| 21 | Sacuwin leads the Heart care rail through `sortOrder` 0–2 (controller ruling, landed in #51); override if wanted, and review the other rulings in `rulings.md` | owner's override | — |
| 22 | Set `APP_URL` to the real site URL in the Production scope (H4 gate) | without it `metadataBase` falls back to localhost and Open Graph links point there | launch |
| 23 | Where personal data is stored and how long each kind is kept; then a legal review of the privacy policy | `/legal/privacy` shows "To be added" for both (DPDP Act retention limits); the H4 gate does not check page copy | launch |
| 24 | Limits on liability, and the governing law and jurisdiction, for the terms of use; then a legal review of the terms | `/legal/terms` shows "To be added" for both; the H4 gate does not check page copy | launch |

## What is next

Phases K (cart) and R (prescriptions) have a plan (in progress):
[superpowers/plans/2026-11-27-phase-kr-cart-prescriptions.md](superpowers/plans/2026-11-27-phase-kr-cart-prescriptions.md)
(15 tasks K1–K7, R1–R7 and the KR8 gate; its provisional rulings are in `decisions/rulings.md`). The other
phases after UI each get their own plan under `docs/superpowers/plans/` before work starts. Scope comes from the [project plan](plan/project-plan.md)
(Stage 5 phase table) and `docs/requirements.md`; obligations already carried are listed per phase. K and R are in flight (see "In flight"); the rest have no plan yet.

| Phase | Ships | Carried obligations (where recorded) |
| --- | --- | --- |
| **K** Cart | K1 cart API with guest merge; K2 shared cart store and drawer, replacing the UI plan's session-only cart and removing `/cart` from `PENDING_ROUTES` | enforce 10 per product and 20 packs per order; `requireUser` re-issues the sliding customer cookie whenever it slides the session; restore the cart-merge line on the login page (phase-ca-ledger "Carry → … K1"; UI plan "After this plan") |
| **R** Prescriptions | file validation (magic bytes, sharp re-encode, PDF checks); private storage (Vercel Blob) and API; upload UI; `/account/prescriptions` (R3) | store `rxDate` as IST midnight via an `istMidnight` helper; pharmacist valid-until = next IST midnight; no Rx content in logs or messages (phase-ca-ledger "Carry → R phase") |
| **O** Orders and payments ([plan](superpowers/plans/2026-11-28-phase-o-orders-payments.md); the handoff's O2 is the plan's O6, O5 is O4) | O2 COD placement (idempotent, priced on the server); checkout stepper and reduced checkout header; order history; Razorpay order + verify; webhook; reconcile cron | O2 judges the Rx at `createdAt` and passes server time as `ctx.at`; `hold` is staff-only; customer cancel only until packed; `refund_pending` in the same write as the hold; idempotent refunds; decide whether a refund is deferred while on hold (F16); COD ≤ ₹5,000; replace the fake gateway with a contract-tested fake (phase-ca-ledger, phase-f-ledger "Parked … O5") |
| **N** Notifications | outbox and cron; MSG91 SMS; Resend email and templates; event wiring | adapters keep OTP codes out of logs; DLT templates; messages never carry prescription content (phase-ca-ledger "Carry → N phase") |
| **D** Admin | shell and roles; Rx review API and UI; orders API and UI; products API and UI (MRP edit, photo swap, "needs photo swap" filter) | every MRP, photo, active or category write calls `revalidateCatalogue()`; category names admin-editable; D1 creates staff users and revokes a user's sessions on a role change; a user status (block or delete) honoured by verify and `getAuth`; prototype carries: `AAR-` order ids, ship URL with AWB over https, Rx re-check on confirm/pack/ship, required match attestation on approve, append-only audit trail UI, confirm MRP changes over 25 %, confirm deactivation (UI plan "After this plan"; phase-ca-ledger "Carry → H2/D"; the admin prototype review, recorded here) |
| **P** Account | P1 `/account`: track an order, profile, addresses, marketing opt-out, data download and deletion; **a Sign out action** (nothing calls `POST /api/auth/logout` yet) | DPDP rights (requirements §10); deploy blocker 6 |
| **H** Hardening and deploy | security headers (CSP) and log redaction; privacy rights and retention; Lighthouse CI; H4 production gates; index drift detection; H5 production deploy and runbook | H4: startup assertion `VERCEL_ENV=production ⇒ MONGODB_DB=aarvion_prod`, `assertLegalConfigComplete()` from `instrumentation.ts`, refuse a production build while `PENDING_ROUTES` is non-empty, an `https` `APP_URL`, security headers incl. `frame-ancestors 'none'`; production `db:indexes` needs dev dependencies (tsx); parked minors: health failure logging, pingDb timeout log, test env restore, the double build in e2e, stale `public/products` file and hash checks ([deploy.md](dev/deploy.md#production-gates-phase-h-planned); phase-f-ledger and phase-ca-ledger "Parked … Phase H") |

## Known issues

- **Production cannot serve logins yet:** the real providers (`msg91`, `resend`, `razorpay`)
  are accepted by the env schema but throw "not implemented yet"; mocks are refused in
  production. Built in N and O. The private Blob file store (`FILE_STORE=blob`) exists since R3;
  `pnpm vercel-build` refuses a Vercel build without it (confirm on the first deploy that the
  project's build command runs `vercel-build`).
- **The repository is public** (since 2026-11-19): keep secrets and personal data out of every file and commit.
- **`MONGODB_DB=aarvion_prod` is not asserted at startup** until H4. A production deploy on
  another DB name, sharing a database with a mocks-enabled preview, would bypass the guard.
- **Insert-only seed:** changes to existing products or categories in the JSON or code do not
  reach existing databases; the runbooks give the targeted updates.
- **Third-party lockout (F11):** someone who knows a phone or email can still lock that user out
  of login for 24 h, at the cost of two real OTP sends each (accepted risk). A timing difference
  between a mismatch and a missing challenge is also accepted.
- No user status (disabled or deleted) exists; a hard-deleted user re-registers on the next
  verify (carried to H2/D).
- No index drift detection: `ensureIndexes` matches by name only (phase H).
- A prepaid order put on hold with its refund executed can only be cancelled (F16; O2 decides).
- Two local `pnpm test:int` runs at once share port blocks and retry (slower, not failing).
  CI's `int` job timed out once on `tests/int/auth-otp-verify.test.ts` (#47, passed on rerun), and
  `MongoMemoryServer` startup failures (`ECONNREFUSED` on its port) recur locally when several
  worktrees run int tests at once: rerun; CI is unaffected.
- Vitest prints a warning that `vitest.config.ts` is ESM loaded as CommonJS (no `"type":
  "module"` in `package.json`); harmless.
- The UI plan's Global Constraints exclude "docs" from the PR size, but `scripts/pr-size.ts`
  does not, and the owner keeps it that way (2026-11-18): split big docs PRs like code PRs.
- The prototype generator `design/prototype/src/build.mjs` hard-codes an absolute root path on
  the owner's machine, and its header comment says % off is rounded while the code floors (the
  code is right).
- Some docs say "8 Win2Age products"; the data has 7 `win2age` and 1 `unbranded` (Caftop).

## How to resume (for an agent, on any machine)

1. Read [AGENTS.md](../AGENTS.md), this page, [dev/README.md](dev/README.md) and the
   [project plan](plan/project-plan.md).
2. See what changed since "Current state" was written:
   `git fetch origin && git log --oneline b5cd2f5..origin/main` (the `main` commit this page was last refreshed at), `gh pr list --state open`, and
   the `[Unreleased]` section of the CHANGELOG. Update "Current state" first if it is stale.
3. Find each task's status by matching merged and open PR branch names against the task table
   (the plan names every branch), and read new rulings in `docs/decisions/rulings.md`. If you
   are the controller on its own machine, its gitignored ledger has more detail.
4. Make a worktree from fresh `main` for your task:
   `git worktree add ../aarvion-<task> -b <type/short-desc> origin/main`, then `pnpm install` and
   the full local check, to start from green.
5. Take the next task whose dependencies are merged ("Order and dependencies" in the plan). Follow
   its steps: failing tests first, the GATE, the VISUAL check for UI tasks.
6. Open the PR (What / Why / How tested / Risks and rollback), wait with
   `gh pr checks <n> --watch --interval 20`, and get a review. Merge only through
   `scripts/merge-gate.sh` and only if you are authorised; otherwise ask.
7. In the same PR: a CHANGELOG line, docs under `docs/dev/`, and this page's "Current state".
8. Blocked on the owner? Add it to "Open owner actions", say so in your report, and continue with
   tasks that do not depend on it.

## Where everything lives

| Artefact | Location |
| --- | --- |
| Rules for agents | [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md) |
| Developer docs and runbooks | [docs/dev/](dev/README.md) |
| State and history | this page; [CHANGELOG.md](../CHANGELOG.md); `git log`; merged PRs on GitHub. [progress.md](progress.md) is retired and points here |
| Project plan | [plan/project-plan.md](plan/project-plan.md): context, owner decisions, Stages 0–6, the phase table, owner inputs |
| Phase plans | [superpowers/plans/](superpowers/plans/) |
| Product and requirements | [PRODUCT.md](../PRODUCT.md), [requirements.md](requirements.md), [catalogue.md](catalogue.md), [missing-products.md](missing-products.md) |
| Decisions and ledgers | [decisions/](decisions/): `rulings.md`, `stack.md`, `db.md`, `environments.md`, `repo.md`, and one ledger per finished phase (`phase-f-ledger.md`, `phase-ca-ledger.md`, `phase-ui-ledger.md`) |
| Design system | [DESIGN.md](../DESIGN.md), `.impeccable/design.json`, surface briefs in `.impeccable/surfaces/`, [design/direction-round-1.md](design/direction-round-1.md), review pages in [review/](review/) |
| Prototype | [design/prototype/](../design/prototype/) (generator in `design/prototype/src/`); published copy https://claude.ai/artifact/BCPDh3iJPP6asGvRz3xJkc |
| Seed data and images | `data/products.json`, `data/product-images.json`, `data/source/`, `assets/products/{original,cutout}/`, `public/products/` |
| Brand | the official logo in `public/brand/` (served, with a usage README); masters and source in `assets/brand/official/`; app icons in `src/app/`; generator `scripts/trace_logo.py` |
| Banners and foil | round-1 scenes `assets/banners/round1/`; store scenes and `PROVENANCE.md` in `assets/banners/store/`; composites in `design/prototype/assets/banners/`; served copies with sidecars in `public/banners/` and `public/foil/`; image generation ran in the owner's Figma file `dlvnZAbqR9Vbnk3Sg7Eixi` |
| Fonts | sources and licences in `assets/fonts/`; subsets in `src/fonts/` |
| Scripts | `scripts/merge-gate.sh` (the merge gate), `scripts/shoot.mjs` (screenshots), `scripts/trace_logo.py` (logo), `scripts/*.ts` (pr-size, images, seed, indexes, fonts), `scripts/*.py` (foil, cutouts, banners, flyer, Stage 0 docs) |
| CI | `.github/workflows/`, `.github/dependabot.yml`, runs and artifacts on GitHub Actions |
