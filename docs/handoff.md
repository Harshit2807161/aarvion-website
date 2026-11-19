# Handoff

For whoever takes over the Aarvion storefront, agent or human. Read [AGENTS.md](../AGENTS.md)
first, then this page. **Last updated 2026-11-18** (main at `7c73cc7`, PR #46). Whoever lands a
task, opens a phase or clears an owner action updates this page in the same PR.

Repo: `Harshit2807161/aarvion-website` (private). Owner: Aarvion Pharmaceuticals, New Delhi. The
owner delegated design and build decisions and authorised the build controller to merge green
PRs; every ruling made for them is in [decisions/rulings.md](decisions/rulings.md) for review.

## Current state

What a visitor sees today: a placeholder home ("Aarvion: coming soon"), plus the JSON APIs below.
No deployment exists. History by PR: [CHANGELOG.md](../CHANGELOG.md).

| Phase | Status | PRs | What exists |
| --- | --- | --- | --- |
| Stages 0–3: data, requirements, design | done | #1, #37, #43 | catalogue docs and seed data; requirements v0.1 (owner accepted the defaults); `DESIGN.md`; the hi-fi prototype, store v2 approved by the owner on 2026-11-18 |
| F Foundation (F1–F4) | done | #2, #3, #10, #11, #13, #14; Dependabot #4–#8 | Next.js app, env loader, health route, CI and PR guards, Mongo client and index registry, provider container with mocks, Playwright harness |
| F5 tokens and base styles (UI Task 1) | done | #45, #46 | Tailwind 4 with the design tokens in `src/app/globals.css`, merged base styles in `src/styles/base.css`, `cn()`, every test file mapped to one Vitest project, the `ui` project's React setup, the dependency policy test, the Phase UI rulings in `rulings.md` |
| F5–F8 fonts, primitives, shell, legal pages | in progress (UI plan) | | |
| C Catalogue (C1–C2) | done | #16–#20 | schemas, pricing, hashed images, insert-only seed, queries and search |
| C3–C5 home, category, product, search UI | in the UI plan | | |
| A Auth (A1–A4) | done | #21–#23, #25–#33, #40 | rate limiter, OTP send and verify, sessions, guards, `/api/auth/me`, logout, audit log, preview isolation, `/dev/outbox`, auth e2e |
| A5 login UI | in the UI plan | | |
| O1 order domain | done | #35, #36, #38, #39 | Rx validity, pure order state machine, order numbers |
| Plans and records | done | #15, #41, #42, #44 | Phase CA plan, rulings log, Phase CA ledger, UI plan (revision 2) |
| K, R, O2+, N, D, P, H | not started | | see "What is next" |

Routes on `main`: `GET /api/health`, `POST /api/auth/otp/send`, `POST /api/auth/otp/verify`,
`GET /api/auth/me`, `POST /api/auth/logout`, `GET /dev/outbox` (dev only). Collections:
[architecture.md](dev/architecture.md#collections-and-indexes).

## In flight

The **UI phase plan**, revision 2:
[superpowers/plans/2026-11-17-phase-ui.md](superpowers/plans/2026-11-17-phase-ui.md). 44 tasks,
one PR each, run with subagent-driven development: an implementer per task, a task review, then
the controller merges through the gate. Its Global Constraints, Decisions and "Order and
dependencies" sections are binding.

As of 2026-11-18:
- UI Task 1 is done (#45, #46). By controller ruling, their CHANGELOG lines go into the first UI
  PR opened after the CHANGELOG part of the docs split merges.
- The owner allowed parallel worktrees, so the controller runs three tracks with disjoint files:
  A in `/Users/harshi/aarvion-build` (Tasks 2 → 3 → 4/5/6), B in `aarvion-wt-b` (8 → 7, then 38),
  D in `aarvion-wt-d` (16 → 18 → 26). Only track A runs e2e locally (port 3100 and the
  `aarvion_e2e` database would collide); B and D rely on CI's e2e job. Open now: #48 (Task 16)
  and #51 (Task 8); Task 2 is in progress.
- The logo work, `feat/brand-logo`, in `/Users/harshi/aarvion-logo`: the owner's official logo
  traced to vector, with variants in `public/brand/`. Ruling: this drops the plan's Montserrat
  wordmark subset from Task 2, and the header, footer and close use the `public/brand` SVGs
  (in progress; no PR yet).
- The agent docs, split from #47 to respect the 400-line limit: #49 (AGENTS.md, CLAUDE.md,
  README), #50 (docs index, setup, architecture), #52 (testing, CI, data), #53 (deploy and
  operations runbooks), #54 (catalogue runbooks), this handoff, and the CHANGELOG part, from
  `/Users/harshi/aarvion-docs`.

The controller's ledger for the phase is `/Users/harshi/aarvion-build/.superpowers/sdd/2026-11-17-phase-ui/progress.md`
(local and gitignored), with the pre-flight scan `preflight.md` (rulings C1–C31). At phase end it
is persisted to `docs/decisions/`, as `phase-f-ledger.md` and `phase-ca-ledger.md` were.

| # | Task | Branch | Spec | Status |
| --- | --- | --- | --- | --- |
| 1 | Tailwind 4, design tokens, merged base styles and the rulings record | `feat/ui-tokens-a`, `feat/ui-tokens-b` | F5 | merged (#45, #46) |
| 2 | Self-hosted subset fonts, icons, rupee formatting and the screenshot tool | `feat/ui-fonts-icons` | F5 | in progress (track A) |
| 3 | Button, badges, stamp price with % off, and the styleguide | `feat/ui-base-components` | F5 | not started |
| 4 | Dialog and sheet overlay with the phone bottom sheet | `feat/ui-overlay` | F6 | not started |
| 5 | Text field, checkbox and segmented control | `feat/ui-fields` | F6 | not started |
| 6 | OTP field, customer toast and live region | `feat/ui-otp-toast` | F6 | not started |
| 7 | Cache Components, shelf order and the cached, tagged catalogue | `feat/catalogue-cache` | C3 | not started |
| 8 | Shopper category names | `feat/category-display-names` | v2 brief | open, #51 (track B) |
| 9 | Site config, routes, store footer and the Operate shell | `feat/site-footer-config` | F7 | not started |
| 10 | Announcement bar and store header | `feat/store-header` | F7 | not started |
| 11 | Category bar and mobile chip row | `feat/category-bar` | F7 | not started |
| 12 | 404 and error pages | `feat/error-pages` | F7 | not started |
| 13 | Privacy policy and terms of use | `feat/legal-privacy-terms` | F8 | not started |
| 14 | Refunds, shipping, prescription and grievance policies, and contact | `feat/legal-policies` | F8 | not started |
| 15 | Session-only cart store, cart controls and the header cart pill | `feat/cart-ui-store` | C3/C4 until K2 | not started |
| 16 | Foil and banner rasters into `public/` with provenance | `chore/public-rasters` | C3 | open, #48 (track D) |
| 17 | Display helpers and the foil pocket with % off | `feat/catalogue-pocket` | C3 | not started |
| 18 | Banner carousel controller | `feat/banner-carousel-controller` | C3 | not started |
| 19 | Hero banner with LCP on slide 1 | `feat/home-banner` | C3 | not started |
| 20 | Quick actions and trust strip | `feat/home-quick-trust` | C3 | not started |
| 21 | "Shop by category" bento | `feat/home-category-bento` | C3 | not started |
| 22 | Product rails | `feat/home-rails` | C3 | not started |
| 23 | Rail controls: arrows and the "View all" interim | `feat/rail-controls` | C3 | not started |
| 24 | "How ordering works" (static) | `feat/home-ordering-steps` | C3 | not started |
| 25 | FAQ and the closing act (static) | `feat/home-faq-close` | C3 | not started |
| 26 | Film math | `feat/film-math` | C3 | not started |
| 27 | Film engine | `feat/film-engine` | C3 | not started |
| 28 | Film motion, the hydration-safe flag and the home budgets | `feat/film-motion` | C3 | not started |
| 29 | Home finish-review gate | `fix/home-finish-review` | C3 | not started |
| 30 | Category page, and "View all" becomes a link | `feat/category-page` | C3b | not started |
| 31 | Country of origin, product facts and the strength switcher | `feat/product-facts` | C4 | not started |
| 32 | Product page | `feat/product-page` | C4 | not started |
| 33 | Product SEO, sitemap, robots, product budgets and catalogue freshness | `feat/product-seo` | C4 | not started |
| 34 | Category and product finish-review gate | `fix/catalogue-pages-finish-review` | C3b, C4 | not started |
| 35 | Search API | `feat/search-api` | C5 | not started |
| 36 | Search combobox parts | `feat/search-combobox-parts` | C5 | not started |
| 37 | Header search on every customer page | `feat/header-search` | C5 | not started |
| 38 | Sign-up consent on verify, and the session route | `feat/auth-signup-consent` | A5 | not started |
| 39 | Phone helpers, the login API client and the `?next=` sanitiser | `feat/login-api` | A5 | not started |
| 40 | Login state machine and copy | `feat/login-machine` | A5 | not started |
| 41 | `/login` page: the id and code steps | `feat/login-page` | A5 | not started |
| 42 | Sign-up and done steps, demo states and the login e2e | `feat/login-signup-steps` | A5 | not started |
| 43 | Header sign-in dialog and account pill | `feat/login-dialog` | A5 | not started |
| 44 | Login finish-review gate | `fix/login-finish-review` | A5 | not started |

## What is next

No plan is written yet for the phases after UI; each gets its own plan under
`docs/superpowers/plans/` before work starts. Scope comes from the project plan (Stage 5 phase
table) and `docs/requirements.md`; obligations already carried are listed per phase.

| Phase | Ships | Carried obligations (where recorded) |
| --- | --- | --- |
| **K** Cart | K1 cart API with guest merge; K2 shared cart store and drawer, replacing the UI plan's session-only cart and removing `/cart` from `PENDING_ROUTES` | enforce 10 per product and 20 packs per order; `requireUser` re-issues the sliding customer cookie whenever it slides the session; restore the cart-merge line on the login page (phase-ca-ledger "Carry → … K1"; UI plan "After this plan") |
| **R** Prescriptions | file validation (magic bytes, sharp re-encode, PDF checks); private storage (Vercel Blob) and API; upload UI; `/account/prescriptions` (R3) | store `rxDate` as IST midnight via an `istMidnight` helper; pharmacist valid-until = next IST midnight; no Rx content in logs or messages (phase-ca-ledger "Carry → R phase") |
| **O** Orders and payments | O2 COD placement (idempotent, priced on the server); checkout stepper and reduced checkout header; order history; Razorpay order + verify; webhook; reconcile cron | O2 judges the Rx at `createdAt` and passes server time as `ctx.at`; `hold` is staff-only; customer cancel only until packed; `refund_pending` in the same write as the hold; idempotent refunds; decide whether a refund is deferred while on hold (F16); COD ≤ ₹5,000; replace the fake gateway with a contract-tested fake (phase-ca-ledger, phase-f-ledger "Parked … O5") |
| **N** Notifications | outbox and cron; MSG91 SMS; Resend email and templates; event wiring | adapters keep OTP codes out of logs; DLT templates; messages never carry prescription content (phase-ca-ledger "Carry → N phase") |
| **D** Admin | shell and roles; Rx review API and UI; orders API and UI; products API and UI (MRP edit, photo swap, "needs photo swap" filter) | every MRP, photo, active or category write calls `revalidateCatalogue()`; category names admin-editable; D1 creates staff users and revokes a user's sessions on a role change; a user status (block or delete) honoured by verify and `getAuth`; prototype carries: `AAR-` order ids, ship URL with AWB over https, Rx re-check on confirm/pack/ship, required match attestation on approve, append-only audit trail UI, confirm MRP changes over 25 %, confirm deactivation (UI plan "After this plan"; phase-ca-ledger "Carry → H2/D"; owner's progress log) |
| **P** Account | P1 `/account`: track an order, profile, addresses, marketing opt-out, data download and deletion | DPDP rights (requirements §10) |
| **H** Hardening and deploy | security headers (CSP) and log redaction; privacy rights and retention; Lighthouse CI; H4 production gates; index drift detection; H5 production deploy and runbook | H4: startup assertion `VERCEL_ENV=production ⇒ MONGODB_DB=aarvion_prod`, `assertLegalConfigComplete()` from `instrumentation.ts`; production `db:indexes` needs dev dependencies (tsx); parked minors: health failure logging, pingDb timeout log, test env restore, the double build in e2e, stale `public/products` file and hash checks ([deploy.md](dev/deploy.md#production-gates-phase-h-planned); phase-f-ledger and phase-ca-ledger "Parked … Phase H") |

## Open owner actions and blockers

| # | Item | Why it matters | Blocks |
| --- | --- | --- | --- |
| 1 | A domain | email OTP and notifications need a verified sender | email in production (N) |
| 2 | DLT registration with MSG91 (sender ID + 6 SMS templates) | required by Indian law for any SMS; takes days | SMS OTP and order SMS (N) |
| 3 | Vercel Pro team, linked to GitHub | Hobby is non-commercial | previews and deploy |
| 4 | MongoDB Atlas, Mumbai; then seed each Vercel database (preview before UI Task 9 merges, `aarvion_prod` before the first deploy) | build-time pages need a seeded DB | previews and deploy |
| 5 | Razorpay test keys (by the O phase), then KYC and live keys | online payments | prepaid checkout |
| 6 | Drug licence numbers, registered pharmacist, grievance officer, GSTIN, customer care details | legal display on footer, contact and policies; Razorpay KYC; the H4 gate | launch |
| 7 | Who issues the GST invoice (Aarvion or a dispensing partner), HSN codes and GST rates | invoices | order invoices (O) |
| 8 | Legal confirmation for selling Schedule H medicines online (retail licence or licensed dispensing partner, registered pharmacist) | compliance | launch |
| 9 | Check scroll film and banner carousel smoothness on a mid-range Android phone and a Retina Mac | no device harness here | home finish |
| 10 | A larger Sacuwin 100 photo | asked for by home review #2 (the 2× flyer) | design polish |
| 11 | Confirm Bemptor-R40's MRP (read ₹630; OCR said ₹650) | price correctness | then [change-an-mrp](dev/runbooks/change-an-mrp.md) if wrong |
| 12 | Hyloage and Sysnet Ultra manufacturer names (unreadable on the photos) | Legal Metrology declaration on product pages | product pages |
| 13 | Confirm Mucohelp is the right product (probable match; only back and side panels) | catalogue accuracy | — |
| 14 | Aarvion-branded photos for the 8 placeholder products; photos for the 20 missing products and Vildage-M 50/1000 | Win2Age swap; catalogue growth | [swap](dev/runbooks/swap-a-product-photo.md), [add](dev/runbooks/add-a-product.md) |
| 15 | Branch protection: make the repo public or upgrade to GitHub Pro, then apply the payload in [decisions/repo.md](decisions/repo.md) | the merge gate is process-only today | — |
| 16 | Deleted-branch disclosure: merges #1–#15 used `gh pr merge --delete-branch`, deleting those head branches without asking. Merges since do not delete. Restore any with "Restore branch" on its PR page if wanted | owner's rule on remote branches | — |
| 17 | Approve the banner composites explicitly: the store v2 prototype was approved on 2026-11-18, but the Eye slide shows Win2Age packs | banners ship in UI Task 19 | — |
| 18 | Review the official-logo variants in the logo PR (supersedes the redrawn draft in `assets/brand/` and the "outlined wordmark" input) | brand use everywhere | header and footer |
| 19 | Legally reviewed product information copy (uses, storage, precautions) | sections are omitted until then (no claims) | product pages |
| 20 | Whether Sacuwin should lead the Heart care rail (ruled yes via `sortOrder`, in UI Task 7); review the other rulings in `rulings.md` | owner's override | — |

## Known issues

- **Production cannot serve logins yet:** the real providers (`msg91`, `resend`, `razorpay`,
  `local`, `blob`) are accepted by the env schema but throw "not implemented yet"; mocks are
  refused in production. Built in N, O and R.
- **Branch protection is not applied**; the merge gate is process-only.
- **`MONGODB_DB=aarvion_prod` is not asserted at startup** until H4. A production deploy on
  another DB name, sharing a database with a mocks-enabled preview, would bypass the guard.
- **Insert-only seed:** changes to existing products or categories in the JSON or code do not
  reach existing databases (see the runbooks).
- **Category names** in code are still the therapy-area names until UI Task 8, and existing
  databases need a category re-seed after it.
- `resetRateLimit` after a successful verify is not wrapped in try/catch, so a limiter failure
  there turns a good login into a 500 (carried to A5; UI plan Task 38 [C6]).
- **Third-party lockout (F11):** someone who knows a phone or email can still lock that user out
  of login for 24 h, at the cost of two real OTP sends each (accepted risk). A timing difference
  between a mismatch and a missing challenge is also accepted.
- No user status (disabled or deleted) exists; a hard-deleted user re-registers on the next
  verify (carried to H2/D).
- No index drift detection: `ensureIndexes` matches by name only (phase H).
- A prepaid order put on hold with its refund executed can only be cancelled (F16; O2 decides).
- Two local `pnpm test:int` runs at once share port blocks and retry (slower, not failing).
- Vitest prints a warning that `vitest.config.ts` is ESM loaded as CommonJS (no `"type":
  "module"` in `package.json`); harmless.
- `docs/decisions/repo.md` names `pnpm/action-setup@v4` (CI uses `@v6`) and lists seven required
  checks; the merge gate also requires `branch-name` ([ci.md](dev/ci.md#known-gaps)).
- The UI plan's Global Constraints exclude "docs" from the PR size, but `scripts/pr-size.ts`
  excludes only `docs/superpowers/**` and `docs/decisions/**`. The owner keeps the guard as is
  (2026-11-18): every PR, docs included, stays at or under 400 lines, so split big docs PRs.
- `docs/progress.md` on `main` stops in the Phase F era; the running log continues uncommitted in
  the owner's main checkout (`/Users/harshi/aarvion/docs/progress.md`). This page carries the
  current state.
- The prototype generator `design/prototype/src/build.mjs` hard-codes the root
  `/Users/harshi/aarvion`, and its header comment says % off is rounded while the code floors
  (the code is right).
- Some docs say "8 Win2Age products"; the data has 7 `win2age` and 1 `unbranded` (Caftop).

## How to resume (for an agent)

1. Read [AGENTS.md](../AGENTS.md), this page and [dev/README.md](dev/README.md).
2. See what changed since this page was updated:
   `git fetch origin && git log --oneline 7c73cc7..origin/main`, `gh pr list --state open`, and
   the `[Unreleased]` section of the CHANGELOG. Update the tables above if they are stale.
3. If the local ledger exists (path above), read it for task status and open rulings; otherwise
   match merged PR branch names against the task table.
4. Make a worktree from fresh `main` for your task:
   `git worktree add ../aarvion-<task> -b <type/short-desc> origin/main`, then `pnpm install` and
   the full local check, to start from green.
5. Take the next task whose dependencies are merged ("Order and dependencies" in the plan). Follow
   its steps: failing tests first, the GATE, the VISUAL check for UI tasks.
6. Open the PR (What / Why / How tested / Risks and rollback), wait with
   `gh pr checks <n> --watch --interval 20`, and get a review. Merge only through the gate and
   only if you are authorised; otherwise ask.
7. In the same PR: a CHANGELOG line, docs under `docs/dev/` and this page's tables.
8. Blocked on the owner? Add it to "Open owner actions", say so in your report, and continue with
   tasks that do not depend on it.

## Where everything lives

| Artefact | Location |
| --- | --- |
| Rules for agents | [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md) |
| Developer docs and runbooks | [docs/dev/](dev/README.md) |
| History | [CHANGELOG.md](../CHANGELOG.md), `git log`, merged PRs on GitHub |
| Product and requirements | [PRODUCT.md](../PRODUCT.md), [requirements.md](requirements.md), [catalogue.md](catalogue.md), [missing-products.md](missing-products.md) |
| Decisions and ledgers | [decisions/](decisions/): `rulings.md`, `stack.md`, `db.md`, `environments.md`, `repo.md`, `phase-f-ledger.md`, `phase-ca-ledger.md` |
| Plans | [superpowers/plans/](superpowers/plans/); the project plan (Stage 0–6, phase table, owner inputs) outside the repo at `/Users/harshi/.claude/plans/pasted-content-id-83b6-leave-them-misty-micali.md` |
| Running progress log | [progress.md](progress.md) (stale on `main`); current copy in `/Users/harshi/aarvion/docs/progress.md` |
| Design system | [DESIGN.md](../DESIGN.md), `.impeccable/design.json`, surface briefs in `.impeccable/surfaces/`, [design/direction-round-1.md](design/direction-round-1.md), review pages in [review/](review/) |
| Prototype | [design/prototype/](../design/prototype/) (generator in `design/prototype/src/`); published copy https://claude.ai/artifact/BCPDh3iJPP6asGvRz3xJkc |
| Seed data and images | `data/products.json`, `data/product-images.json`, `data/source/`, `assets/products/{original,cutout}/`, `public/products/` |
| Brand | drafts in `assets/brand/`; official logo variants in `public/brand/` (logo PR, in flight) |
| Banners | round-1 scenes `assets/banners/round1/`; store scenes and `PROVENANCE.md` in `assets/banners/store/`; composites in `design/prototype/assets/banners/`; image generation ran in the owner's Figma file `dlvnZAbqR9Vbnk3Sg7Eixi` |
| Asset scripts | `scripts/*.py` (foil, cutouts, banners, flyer, Stage 0 docs) |
| CI | `.github/workflows/`, `.github/dependabot.yml`, runs and artifacts on GitHub Actions |
| Local tooling (gitignored) | `/Users/harshi/aarvion/.tools/`: `merge-gate.sh`, `shoot.mjs`, `publish-proto.sh` |
| Worktrees | `/Users/harshi/aarvion` (main checkout, read-only reference), `/Users/harshi/aarvion-build` (UI build), `/Users/harshi/aarvion-logo`, `/Users/harshi/aarvion-docs` |
