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
