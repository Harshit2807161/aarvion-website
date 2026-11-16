# Aarvion: running progress log

The owner (2026-11-16) said: "go with the best design and go on with the website design, don't stop till you have finished… follow the plan… I will take a look tomorrow." They also said: "you may merge PRs as well, I want the codebase to be up to date too."

The plan is at `/Users/harshi/.claude/plans/pasted-content-id-83b6-leave-them-misty-micali.md`. Design work follows Impeccable (`~/.claude/skills/impeccable`) and Emil Kowalski's skills (`~/.claude/skills/emil-design-eng`, `animate`, …).

## Done
- [x] Stage 0: data, docs and photos (`data/products.json`, `docs/catalogue.md`, `docs/missing-products.md`)
- [x] Stage 1: requirements v0.1 (`docs/requirements.md`); the owner accepted the proposed defaults ("go with your picks")
- [x] Stack: Next.js 16 App Router + TypeScript (owner's choice)
- [x] Impeccable `PRODUCT.md` written (inferred fields labelled)
- [x] Direction round 1 (`docs/design/direction-round-1.md`): comps in `.impeccable/mocks/decision/{assigned,pick,canon}.png`
- [x] Chosen: **"The Strip"** (forest green + white, foil strip with dot-matrix MRP stamps). Code-led build. Surface brief: `.impeccable/surfaces/design-prototype-index-html.md`

## In flight (2026-11-16, updated)
- [Night run, update 3] Phase F COMPLETE (PRs #2,#3,#10,#11,#13,#14 + Dependabot #4-#8,#6 merged). Rulings: docs/decisions/rulings.md; ledger copy docs/decisions/phase-f-ledger.md.
- Home finish review #1 = REBUILD (foil was CSS imitation). Rebuild agent running: raster foil plates via scripts/render_foil.py (numpy venv in .tools/venv), Act 1 dead air, ghost pockets, fog over strip, flyer cap, MRP legibility, spacing. Report → .impeccable/review/rebuild-1-report.md. NEXT: fresh full finish review #2 → fix/verdict → documenter (DESIGN.md).
- Parallel: customer flow prototypes (design/prototype/pages/*, css/flows.css, js/flows.js) and admin prototypes (design/prototype/admin/*, css/admin.css, js/admin.js) being built; reports → .impeccable/review/flows-report.md, admin-report.md.
- Parallel: plan writer → docs/superpowers/plans/2026-11-17-phase-ca-server.md (C1,C2,A1-A4,O1 server tasks). NEXT: execute with SDD in /Users/harshi/aarvion-build.
- Home prototype BUILT: design/prototype/index.html (5-act scroll film; generator in design/prototype/src/). Finish review #1 running (writes .impeccable/review/finish-review-1.md). Then: one fix round → verdict → documenter writes DESIGN.md + .impeccable/design.json.
- Phase F: PRs #2,#3,#10,#11,#13 merged (+ Dependabot #4,#5,#7,#8). Final review = ready with fixes; fix wave running on fix/foundation-review-fixes.
- Branch protection unavailable (private repo, free plan) — merge only when all required checks (lint,typecheck,unit,int,build,e2e,pr-title) pass. NEVER force-push.
- Home prototype builder subagent: writing design/prototype/ (in /Users/harshi/aarvion, untracked).
- Phase F build: worktree /Users/harshi/aarvion-build; SDD ledger at /Users/harshi/aarvion-build/.superpowers/sdd/2026-11-16-phase-f-foundation/progress.md (read it first after any context reset).
- Repo: https://github.com/Harshit2807161/aarvion-website (private). PR #1 (docs) merged.

## Next
1. Build the home prototype at `design/prototype/index.html` (builder subagent).
2. Finish review (fresh reviewer), one fix round, then DESIGN.md + `.impeccable/design.json` (documenter).
3. Hi-fi prototypes of the remaining pages, inside the world: category, product, search, login/OTP, cart, checkout, order, account, admin.
4. Stack gate: record the recommended defaults (native mongodb driver + zod, MSG91, Resend, Vercel Blob private, DB sessions, Tailwind 4 + shadcn) as decided-by-delegate.
5. Build PR by PR in `Harshit2807161/aarvion-website`; merge each PR after its checks pass.

## Tools
- Screenshots: `node .tools/shoot.mjs <file> <out-prefix> 1440,390 [--viewport-only]` (playwright-core + cached headless Chrome).
- Product cutouts (transparent): `assets/products/cutout/<slug>.webp`. Logo SVGs: `assets/brand/`.
- ₹-safe fonts: Host Grotesk, Geist, Geist Mono, Schibsted Grotesk, Bricolage Grotesque, Familjen Grotesk, Manrope, Figtree, Inter. **Sora has no ₹.**
- Composio Gemini image is disabled; image generation goes through the Figma MCP `generate_image` (file `dlvnZAbqR9Vbnk3Sg7Eixi`, which costs the owner's credits).

- Admin prototype DONE (design/prototype/admin/*). Note: example order numbers use "AV-24801"; the real format is AAR-YYMM-NNNNN, so align them when building admin (D phase) or in a prototype touch-up.

- Admin finish review #1 = FIX (8 material fixes, finish-review-admin-1.md); builder resumed to apply them; then verdict pass by the same reviewer. Carry into Phase D (real admin): AAR order ids, ship URL must contain AWB + https, Rx validity re-check on confirm/pack/ship, required match attestation on approve, append-only audit trail UI, MRP change >25% confirm, deactivate confirm.

- Customer flows finish review #1 = FIX (8 fixes + ceiling: dot-matrix total + stamp motion; finish-review-flows-1.md). Builder resumed; then verdict pass. Carry into the real build: no tick on pending Rx; order pages require a session; the Rx record must be consistent across views; OTP locked state UX.

- Admin prototype: verdict pass = SHIP (all 8 fixes resolved). Non-material notes for Phase D: table wrapper max-height ~100vh-17rem; one audit row per Rx view; Record column not in mono; persona chip consistent across pages; Orders default sort = oldest actionable first for the pack/ship desk.

- Home REBUILD done (procedural raster foil: scripts/render_foil.py, assets/foil/*, 206 KB; perf p95 16.8 ms). Fresh full finish review #2 running → finish-review-2.md.

- Home finish review #2 = FIX (6: flyer DPR cap, knurl contrast at 1x, blank beat Act1→2, mobile Act 3 order, packs fill domes, real-device timing → fallback implemented; owner must check on a real phone). Fix agent running → fix-2-report.md, then verdict pass by reviewer a3a567ef65b1b68be.

- Customer flows: verdict 2 = R2 resolved, R1 partial (3 copy strings). Two-round unattended budget reached; applying the reviewer's exact strings as a final mechanical edit, NOT re-verified by a third verdict (disclosed to the owner).

- Home fix round (review #2) DONE → fix-2-report.md (flyer DPR-independent with blur crossfade, print-field knurl, Act 1→2 overlap, mobile Act 3 order, domes re-rendered; fix-6 fallback measured). Verdict pass running → finish-review-2-verdict.md. Owner action: real-device timing.

- Home review #2 verdict: fixes 1-5 resolved; fix 6 partial (owner device check) + regression (knurl split) → mechanical revert applied by the fixer (end of the 2-round budget). Owner actions: real-device timing; a larger Sacuwin 100 photo for the 2x flyer. NEXT: documenter → DESIGN.md + .impeccable/design.json.

- Home design FINAL (knurl revert applied). Documenter running → DESIGN.md + .impeccable/design.json.

- Design prototype PUBLISHED: https://claude.ai/artifact/BCPDh3iJPP6asGvRz3xJkc (home film + pages/* + admin/*). Republish from scratchpad/proto after design changes (strip doctype/html/head/body from index.html copy first).
