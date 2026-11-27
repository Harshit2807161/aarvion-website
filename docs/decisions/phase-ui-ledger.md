<!-- Persisted from the Phase UI execution ledger (.superpowers/sdd/2026-11-17-phase-ui/progress.md) on 2026-11-28, verbatim. Rulings are copied into rulings.md ("Phase UI execution rulings"); this file keeps the order and the context. -->

# SDD ledger — plan: /Users/harshi/aarvion-build/docs/superpowers/plans/2026-11-17-phase-ui.md

Spec: DESIGN.md + .impeccable/design.json + design/prototype/** + docs/requirements.md + PRODUCT.md (all on origin/main since PR #37). Owner delegated all decisions (2026-11-16); plan-writer rulings in the plan section "Decisions taken in this plan" are accepted unless the pre-flight overturns one.
Carries in from Phase CA (docs/decisions/phase-ca-ledger.md): A5 — resetRateLimit try/catch after successful verify; DPDP consent + 18+; K1 — sliding cookie re-issue (not in this plan).
Setup: Phase CA workspace deleted (ledger persisted in docs/decisions/phase-ca-ledger.md, #41). UI plan committed via PR #42 (merging). merge-gate.sh now waits for checks to register. Pre-flight scan dispatched (opus a4c96223a015d6ea8) → preflight.md.
Pre-flight (opus a4c96223a015d6ea8): 192 rows → preflight.md; 30 conflicts C1–C31 (C4 unused) with proposed rulings. HELD: owner redirected the home page (2026-11-17, see below) — the plan gets revised (Tasks 14–23 + C-rulings folded in) before Task 1 dispatches.
OWNER FEEDBACK (2026-11-17): home looks like a startup site, not a web store. Remove the first product zoom-in and the MRP/₹20 discount sequence (Acts 1–2). Keep: the 'how ordering works' scroll animation, the closing logo pan-in, shop-by-area tiles (rename 'therapy'), the product catalogue as tablets on medicine/foil background. Add: rotating hero banners. Format must match a medicine web store (qtways-website.vercel.app; famous Indian e-pharmacies) — format only, not their fonts/animations.
Carry → UI plan revision: rename CATEGORY_LIST display names to Heart care / Diabetes care / Eye care / Respiratory care (slugs unchanged); section title 'Shop by category' (owner, 2026-11-17).
Store v2 design: fresh finish review = fix (8) → builder fix round → verdict: 8/8 RESOLVED, 2 phone regressions (uneven banner cards, "Show fewer" jump) → final mechanical edit by the builder (end of the 2-round unattended budget; no third verdict).
Pre-flight rulings: ACCEPT the scan's proposed rulings C1–C3, C5–C19, C23–C31 as written (preflight.md). C20/C21/C22 are superseded by the v2 home (strip hero gone) — the plan reviser re-derives asset lists, the hero feature fallback and search result order (category sortOrder, then variant order via the shared compareVariants) — cost if wrong: a re-ordered result list.
Plan revision v2 dispatched (resume plan writer a156d4f29ed5c97c0) on branch docs/phase-ui-plan-v2.
Plan revision 2 written (44 tasks, base eab1c0b; changelog at top). Plan-writer rulings 1–20 ACCEPTED except:
  Ruling (overrides writer #3 in part): shelf order stays the shared rule (category sortOrder → family lowest sortOrder → compareVariants), but the seed data gives the Sacuwin family the lowest product sortOrder in Heart care so the Aarvion-printed packs lead the first rail, matching the banner rule "Win2Age packs never lead" — carried into Task 7's dispatch — cost if wrong: owner reorders via sortOrder.
  Ruling: a scoped pre-flight (rev-2 new/changed tasks 8, 9–11, 15–25, 26–28, 30–33, 35–43) runs in parallel with Task 1; Task 1 itself was scanned in rev 1 and only gained the scan's own C-rulings — cost if wrong: a Task 1 follow-up.
Task 1: dispatching (BASE 7352a44)
Task 1: HELD — owner said 'wait' before dispatch (Agent call errored; nothing dispatched).
OWNER (2026-11-18): "the newest prototype design is good" (store v2 APPROVED). New asks: turn the low-res official logo (navy AARVION wordmark + mint swoosh) into high-res assets and use it throughout; start dev; maintain CHANGELOG.md and dev docs as you go; git worktrees allowed for parallel work; "make sure the site can be easily maintained by agents after deployment and there is easy handoff".
  Ruling: logo = traced vector master of the owner's image (not a redraw); variants: full colour (light ground), reversed (white wordmark + mint swoosh, for forest ground), one-colour forest/white, swoosh mark, favicon/app icons. Logo colours are brand-only tokens, not UI colours — cost if wrong: owner asks for a different reversed treatment.
  Ruling: the Montserrat 800 wordmark subset (plan Task 2) is DROPPED — the wordmark is now an outlined SVG from the official logo — carried into Task 2's dispatch.
  Ruling: agent-maintainability = AGENTS.md (+ CLAUDE.md importing it), docs/dev/** (setup, architecture, testing, CI, data, deploy, runbooks), docs/handoff.md, CHANGELOG.md; every PR keeps them current (dispatch-common + review-common amended) — cost: a few lines per PR.
  Parallel worktrees: /Users/harshi/aarvion-docs (docs/agent-handoff), /Users/harshi/aarvion-logo (feat/brand-logo); Task 1 in /Users/harshi/aarvion-build. Files are disjoint except CHANGELOG.md (created by the docs PR only) and README.md (docs PR appends a final section; Task 1 edits its test-projects section).
Task 1: dispatched (implementer ad8650eb1273c35d5, sonnet, BASE 7352a44, aarvion-build).
Parallel: logo agent a5d577aa36a94fa07 (opus, worktree aarvion-logo, PR feat/brand-logo); docs agent aafac4559675d491d (opus, worktree aarvion-docs, PR docs/agent-handoff).
Carry → Task 2: drop the Montserrat wordmark subset; the header/footer/close use public/brand SVGs from the logo PR.
Task 1: DONE_WITH_CONCERNS — split: 1a PR #45 (377 lines, green, head 9b24ad3); 1b local wip/ui-tokens-b (4b8b5d8, 2fc0eaf, 70c95b1; 391 lines) to open after 1a merges.
  Ruling: stray pushed branch feat/ui-tokens (no PR) is left in place — deleting a remote branch needs the owner's OK; disclose in the summary — cost: one stale branch on GitHub.
  Ruling: CHANGELOG entries for 1a and 1b both go into 1b once the docs PR has merged (1a merges without its own entry) — cost: one PR whose entry lands a PR later.
  Ruling: src/app/globals.css in .prettierignore accepted (Prettier rewrites 0.10 → 0.1 and breaks the verbatim-token test).
Carry → Task 4 (first shadcn add): add the shadcn '@theme inline' colour mapping (bg-background etc.).
Task 1a: review dispatching (sonnet).
Task 1a: review (sonnet) spec ✅, approved, 0C/0I/4M. Merged PR #45.
Task 1a: minor → fold into 1b: stable + settable useSearchParams mock; tokens test asserts placement inside @theme; reset Tailwind default palette (--color-*: initial). Minor (deferred, cosmetic): README line landed in the docs commit.
  Ruling (amends the 1a/1b changelog ruling): CHANGELOG entries for 1a/1b go into whichever UI PR is open first after the docs PR merges — cost: entries land a PR late.
Task 1b: PR #46 (249 lines after compacting base.css to one rule per line; green; head 3c5e357). Review dispatching (sonnet).
Task 1b: review (sonnet) spec ✅, approved, 0C/0I/6M. Pre-merge readability commit requested (expand >120-char base.css rules; forbid tailwindcss-animate; deps-policy reads optional/peer/overrides) — merge on green without re-review (formatting + test-list only).
Task 1b: minor (deferred): hygiene parser ignores quoted strings; no RED shown for hygiene/deps-policy; refactor commit rewrote the feat commit's file (squash makes it moot).
Carry → Task 4: '--color-*: initial' removes --color-black, so shadcn's bg-black/50 overlay compiles to nothing — use a token (e.g. forest-950/50) for the scrim.
Carry → Task 10 (store header): store.css's html{scroll-padding-top: hdr-h + 12px} conflicts with base.css's flows value (sticky-top + 20px) — keep ONE rule; and the container rule per plan ruling #11 (chrome 1280 everywhere; home scopes --container-page 80rem; customer page content stays 75rem).
Task 1b: readability commit eea7162 (348 lines, green). Merged PR #46. Task 1: complete (7352a44..eea7162 via #45, #46; reviews clean).
Docs PR #47 failed pr-size (1,740 lines). Owner flagged it. Ruling: keep the 400-line guard (owner's CLAUDE.md rule); split the docs bootstrap into ~6 PRs ≤400 each (disjoint files, opened in parallel) instead of exempting Markdown — cost: more PRs to merge.
PARALLEL TRACKS (owner allowed worktrees, 2026-11-18). Ruling: three implementation tracks with disjoint files — A (aarvion-build): 2 → 3 → 4/5/6; B (aarvion-wt-b): 8 → 7 → (38 later); D (aarvion-wt-d): 16 → 18 → 26. Only track A runs local e2e (fixed port 3100 + shared aarvion_e2e DB would collide, and Playwright could reuse another worktree's server); tracks B and D rely on CI's isolated e2e job — cost if wrong: an e2e failure found in CI instead of locally.
Task 2 (a9087eb962e95aafb, track A), Task 8 (a78b8b7a2f3b39063, track B), Task 16 (a71c84aa7a631ae1a, track D): dispatched, sonnet, BASE 7c73cc7.
Task 8: DONE_WITH_CONCERNS PR #51 (55 lines, green). Sacuwin sortOrder 0–2 set in data/products.json. CHANGELOG pending docs landing. Review dispatching (sonnet).
Task 8: review (sonnet) spec ✅, approved, 0C/0I/3M — pre-merge commit requested: non-destructive reseed note (agents follow docs literally), requirements wording, all-5 cardiology order test; merge on green.
Task 16: DONE PR #48 (0 counted lines; green). Review dispatching (sonnet).
  Ruling (CHANGELOG catch-up): instead of resuming each implementer, the changelog PR (#56) is updated just before it merges to include entries for every UI PR merged before it (#45, #46, #48, #51, and the docs split PRs); from then on each PR carries its own entry — cost: one combined catch-up edit.
Task 16: review (sonnet) spec ✅, approved, 0C/0I/7M (blob-identical copies verified). Merged PR #48. Task 16: complete.
Task 16: minor (deferred): pixels test skips sidecars lacking `pixels`; prompt/createdAt only type-checked; banner pixel check runs twice; copied sidecars mention uncopied files; two pr-size rows no longer discriminate; public/** exclusion would hide future code in public/ (watch).
Carry → Phase H (go-live): public/**/*.json provenance sidecars are publicly served and contain the Figma file key — before launch move them out of public/ (keep provenance in the repo) or redact the key — cost if ignored: an internal design-file id is visible (access still needs Figma permission).
Task 18: dispatching (track D, aarvion-wt-d).
Task 8: pre-merge commit 27cfa18 (non-destructive reseed note, all-5 order test). Merged PR #51. Task 8: complete. Task 7: dispatching (track B, aarvion-wt-b, opus — app-wide Cache Components + CI build seeding).
Task 7: dispatched (ab3927eb33e07dba8, opus, track B, BASE after #51).
Docs split: #47 closed (branch kept) → #49, #50, #52, #53, #54, #55, #56 (all ≤400, all green). Fact-check review dispatched (opus a6c4310d7f715fa11) → docs-review.md; merge after fixes; #56 gets the changelog catch-up (#45, #46, #48, #51) before it merges.
Minor (deferred → phase-end review): tests/int/auth-otp-verify.test.ts timed out 3× once on a docs-only CI run (#47), passed on rerun — slow-runner flake to investigate.
Task 2: DONE_WITH_CONCERNS — split: 2a PR #57 (fonts + shoot.mjs, 284 lines, green); 2b local 2d6e0c7 (icons, BrandMark, formatRupees). Montserrat dropped as amended.
  Found: main's tests/helpers/ui-setup.ts exports vi.hoisted values (Vitest 5 rejects) → no `ui` test can run on main. Ruling: the fix moves into 2a now (unblocks every track), helper named tests/helpers/navigation-mocks.ts because Task 7 owns tests/helpers/next-mocks.ts (next/server + next/cache mocks) — cost: 2a grows ~40 lines.
Task 18: DONE_WITH_CONCERNS — 18a PR #58 (reducer, 163 lines, green); 18b local (71fcecb ui-setup fix, 1fa763f hook).
  Ruling: 18b DROPS its own ui-setup fix (71fcecb) — the single fix lands in 2a (#57) as tests/helpers/navigation-mocks.ts; 18b opens after both #57 and #58 merge — cost: 18b waits on track A.
  Ruling: the added reducer event {type:"motion", on} is accepted (reduced-motion can only be read in an effect).
Carry → Task 19: the carousel hook owns is-current / is-leaving / inert / img loading on slides — the banner component must not render those through React; hide the pause control when !state.motion.
Task 18a: review dispatching (sonnet).
Task 18a: review (sonnet) spec ✅, approved, 0C/0I/4M. Merged PR #58.
Carry → 18b (fold in): motion-on must NOT clear a user's explicit pause (track userPaused separately from motion-stop) + test; test motion off→on under an active hold; clamp/guard `go` with NaN/non-integer; tests for `ready` and hold no-op identity.
Task 26: dispatched (aae227bdfb6e30cb6, sonnet, track D) while 18b waits on #57.
Task 26: DONE PR #59 (~190 lines, green, cda7af1). Review dispatching (sonnet).
Docs review (opus): all 7 docs PRs "fix first" — 0 Critical, ~15 Important (verify 429 states misdocumented; stale after #48/#51; unguarded "drop and reseed" lines; rotate-secret outage order; add-a-product null MRP breaks pricing.test; merge-gate doesn't check pr-size; handoff not cold-resumable (state only under /Users/harshi paths); CHANGELOG catch-up). Review: docs-review.md.
  Ruling: merge-gate now REQUIRES pr-size (owner treats the 400 cap as binding); ALLOW_OVERSIZE=1 only with a recorded ruling (e.g. design prototype imports) — local script updated now; the script moves into the repo as scripts/merge-gate.sh (documented in ci.md) so a future maintainer has it.
  Ruling: cold resume — commit the approved project plan as docs/plan/project-plan.md; docs/handoff.md becomes the living state document (its "Current state" section is updated as PRs merge); the repo's stale docs/progress.md is retired to a pointer; SDD ledgers are persisted to docs/decisions/ at each phase end (as for F and CA).
Task 26: review (sonnet) spec ✅, needs fixes 0C/2I/3M — I1 NaN/zero-width in clamp01/rangeValue/measureAct; I2 deepLinkTarget NaN. Fix round 1 dispatched (resume aae227bdfb6e30cb6), minors folded in. Docs: fixes dispatched (resume aafac4559675d491d) with merge-gate/cold-resume/catch-up/guard/rotate rulings.
Task 2a: #57 now 325 lines incl. ui-setup fix (navigation-mocks.ts) + ui smoke test; merged origin/main to clear a conflict; green at ff73001. Review dispatching (sonnet).
Task 2a: review (sonnet) spec ✅, approved, 0C/0I/6M (subsets verified with fontkit: ₹ present, axes, name IDs 13/14, sizes 17–22 KB). Merged PR #57.
Carry → 2b (fold in): note that the Geist OFL covers Geist Mono (without altering licence text); tie src/fonts weights to FONT_JOBS by test; remove dead `text:"core"` union/branch; add U+2022/U+2212 to the glyph test.
Carry → all later UI tasks: navigation mock state is imported from tests/helpers/navigation-mocks (plan lines that say ui-setup exports mockPathname are superseded).
Minor (deferred): globals.css 120-char comment; shoot.mjs dense (copied tool).
Task 26: fix round 1 → 8f6468a (finite on NaN/zero-width, strict deep-link parse, hasOwn EASE, tests 24). Scoped re-review dispatching (sonnet).
Process note: Task 26's fix agent finished before 18b switched aarvion-wt-d's branch, so no collision; spare worktree /Users/harshi/aarvion-wt-e created (kept for the next parallel task). Ruling: one live agent per worktree, always.
Task 26: fix round 1/5 (2I + 3M addressed; 1008 valid-input combos unchanged). Merged PR #59. Task 26: complete. Minor (deferred): deep-link regex rejects a trailing dot ('?p=3:1.'), nothing generates it.
Task 27: dispatching (track E, aarvion-wt-e; needs 26 ✓).
Task 7: DONE_WITH_CONCERNS — split: 7a PR #60 (compareVariants + Cache Components + connection() first; 361 lines; green); 7b local (0ec9416 cached tagged reads + revalidate, 00dd81f seeded CI build).
  Ruling: Heart care leads Sacuwin 50/100/200 then Bemptor (per #51), overriding the brief's older Bemptor-first expectation — accepted.
  Ruling: set experimental/partialPrefetching per the current Next 16 docs' recommendation in 7b (with a config test) — cost: different prefetch behaviour, revertible.
  Ruling: withErrors must rethrow Next control-flow errors (unstable_rethrow or equivalent current API) so prerender aborts, redirects and notFound pass through — fix in 7b with a test — cost: none.
Task 7a: review dispatching (opus — app-wide rendering change).
Task 2b: PR #62 (374 lines, green, 8869f51); BrandMark points at /brand/aarvion-logo{,-reversed}.svg pending the logo PR. Review dispatching (sonnet).
Task 27: DONE PR #65 (382 lines, green).
  Ruling: with film:false (reduced motion / no JS) createFilm is a full no-op — no scroll, IO, resize or ?p= deep link — accepted: the static composition needs none, and film-frame captures run with motion on — cost: none.
Task 27: review dispatching (sonnet).
Task 18b: split → #63 (hook, 399 lines) + 18c #64 (reducer hardening = 18a minors, 54 lines); both green. Review dispatching (sonnet, both).
Task 2b: review (sonnet) spec ✅, needs fixes 0C/2I/7M — I1 Icon size ineffective (base.css .i width wins); I2 BrandMark no intrinsic size (CLS). Fix round 1 dispatched (resume a9087eb962e95aafb).
  Ruling: BrandMark sizes from an exported BRAND_LOGO_RATIO (provisional 3.0 from the owner's image ~903×302); the logo PR pins the SVG viewBox ratio to it within 1% by test and owns the final value — cost: one constant to update.
Task 27: review (sonnet) spec ✅, approved, 0C/0I/9M. Merged PR #65. Task 27: complete.
Task 27: minor (deferred → Task 28 film motion): test the per-item vi/vo skip; destroy test checks handler identity + cancelAnimationFrame + timer; pin the full film:false no-op; use clamp01 for the duplicate clamp; decode() once per element not every enter; drop the extra initial RO measure; run the ?p= jump on load like the prototype.
Carry → Task 28: the engine sets `measuring` on its root (not <html>) — CSS must use descendant selectors (.film-root.measuring …), never html.measuring; `.live` will-change CSS lands with the film CSS; wire the engine into the home page.
Task 18b/18c: review (sonnet) both spec ✅, approved (0C/0I; 7M + 2M); merge-tree clean both orders. Merged PR #63 and PR #64. Task 18: complete.
Carry → Task 19 (banner component): autoplay timing is the CSS `dot-run` animation (6 s), restarted on slide change and paused under is-held/is-stopped — AUTOPLAY_MS is unused; slide 1 must be visible before hydration (SSR is-current on the first slide); hide the pause control when !state.motion; mirror the Number.isInteger guard in the hook's go() for the phone scroll path; start with a `hidden` hold if the tab starts hidden; test the reduced-motion/phone change listeners, unmount cleanup, away and pointercancel.
Task 18: minor (deferred): stateRef written during render; slide-class effects in useEffect not layout effect; count read only at init.
Task 7a: review (opus) spec ✅, approved, 0C/0I/4M; Cache Components verified against installed Next 16.4.6: no auth/session/OTP/rate-limit route can be prerendered or cached. Merged PR #60.
Carry → 7b (fold in): order.ts `toSorted` → `[...products].sort()` (Firefox 111–114 in Next's browserslist, no polyfill); dev-only.ts docstring "call first" contradicts C8; test unknown-category-last and familySlug tie-break; route-config guard also matches route.tsx/route.js.
Task 2b: fix round 1 → 930852b (Icon --i-size, BrandMark BRAND_LOGO_RATIO, bigint rupees, ICON_NAMES); trimmed comments/one duplicate test/fonts README to reach 399. Scoped re-review dispatching (sonnet), incl. checking the trims removed nothing meaningful.
Logo: PR #67 (brand-logo-a, 334 lines, green): traced masters (IoU swoosh 0.9923, wordmark 0.9934), public/brand + README, app icons, brand-assets test, prototype + DESIGN.md + design.json; trace_logo.py in a later PR (ce31598, 396 lines). viewBox ratio 3.009 → BRAND_LOGO_RATIO stays 3.0.
  Ruling: mint/navy documented as logo-only colours (DESIGN.md Logo + design.json extensions.logo), NOT theme tokens — accepted.
  Ruling: "PHARMACEUTICALS" dropped from footer/admin lockups (the official logo has none; the legal name stays in the address and copyright) — accepted.
Carry → Task 9 (site config): set metadataBase from siteConfig's site URL so opengraph-image resolves (else localhost).
Logo PR review dispatching (sonnet).
Task 2b: re-review — I1/I2 ADDRESSED, but trims lost maintainer info (fonts README details; BRAND_LOGO_RATIO export-name clause). Ruling: no trimming of meaningful content for the cap — split along the seam: #62 = icons/BrandMark/rupees (+ restored clause); new chore/fonts-tidy PR = 2a minors + complete fonts README — cost: one more PR. Fix round 2 dispatched.
Prototype artifact republished as version 5 with the official logo (shared 'anyone with the link' by the owner). publish-proto.sh now writes to the current scratchpad.
Logo #67: review (sonnet) spec ✅, approved after 1 Important (READMEs cite scripts/trace_logo.py, not yet in repo). Ruling: open logo PR B (trace_logo.py) now and merge A then B back-to-back; READMEs name B's PR — cost: none. Minor 4 deferred (logo-review.md).
Task 7b: PR #68 (365 lines, green; unstable_rethrow first in withErrors; partialPrefetching true; 7a minors fixed). Review dispatching (opus).
Task 2b: fix round 2 → #62 74d6092 (375 lines, fonts changes removed, comments restored) + #69 chore/fonts-tidy (50 lines, complete README). Scoped re-review dispatching (sonnet).
Task 2b: fix round 2/5 (2 addressed, 0 open). Merged PR #62 and PR #69. Task 2: complete (#57, #62, #69).
Task 3: dispatching (track A, aarvion-build; needs 2 ✓).
Task 3: dispatched (a65afd8e78b0ef758, sonnet, track A; BASE after #62/#69).
Also: dispatch-common rule reinforced in dispatches: never drop tests or meaningful comments/docs to fit 400; split instead.
Docs fix round: 9 PRs green (#49,#50,#52,#53,#54,#55,#56 + new #61 plan, #66 merge-gate.sh). Scoped re-review dispatching (sonnet). Not done by ruling: v0.1.0 tag (owner call); #61 keeps one /Users path (verbatim plan copy).
Logo: #67 fix ADDRESSED (READMEs → #70); #70 review approved 0C/0I/5M (exactly 400 lines). Merged PR #67 then PR #70. Official logo is on main (public/brand, app icons, prototype).
Minor (deferred): assets/brand/official/README.md:39 repeats "Regenerate"; #70's 5 minors (logo-b-review.md).
Docs re-review: all 9 mergeable. Merged #49, #52, #53, #54, #61, #66. Final refresh dispatched for #50 (guard dropDatabase with getName in one command), #55 (handoff state), #56 (changelog lines for #62, #69, #67, #70, docs PRs).
Task 7b: review (opus) spec ✅, approved, 0C/0I/5M (revalidateTag expire:0; every read tagged; price derived inside cache). Pre-merge commit requested: valid-slug-only per-slug tags (no user text in logs), freshness-gap docs, .jsx glob, private-import comment, made-up unknown slug; merge on green.
Carry → first page reading the cached catalogue (Task 17/22 or 25/26): ship the freshness e2e (P55) proving a page re-reads after revalidateCatalogue().
Carry → Phase D (admin MRP edit): call revalidateCatalogue() on every MRP/product change. Carry → K/O: cart and checkout reprice from Mongo, never from cached reads.
Task 3: DONE_WITH_CONCERNS — split: 3a PR #71 (percentOff + Rx badge/status tags/stamp price; 286 lines; green); 3b local (cb5a561 Button/ButtonLink, fe57cd6 /dev/styleguide).
Carry → 3b: /dev/* must return a real HTTP 404 in production (not a 200 not-found shell) — prefer a proxy/middleware rule or a build-time production exclusion; verify that `export const instant = false` is a real Next 16 API before relying on it.
Task 3a: review dispatching (sonnet).
Task 3a: review (sonnet) spec ✅, approved w/ 1 Important (plan-mandated): PriceInline lacks DESIGN.md's sr-only "Printed"/", our price" text.
  Ruling: DESIGN.md (spec) wins over the brief's markup — add the sr-only spans — cost: none.
  Ruling: never render a "0% off" tag (percentOff < 1 when MRP > ₹2,000) — omit the tag, keep struck MRP + price — cost: none.
  Fix round 1 dispatched (resume a65afd8e78b0ef758) with edge tests and the phone stamp rules.
Docs: final refresh (#50 guarded drop in one command, architecture updated for #62/#67; #56 lines through #70; #55 handoff at 04c83db + AGENTS.md logo text). Merged #50, #56, #55. DOCS BOOTSTRAP COMPLETE: AGENTS.md, CLAUDE.md, docs/dev/**, runbooks, docs/handoff.md, docs/plan/project-plan.md, CHANGELOG.md, scripts/merge-gate.sh all on main.
From now on every PR carries its own CHANGELOG line and docs updates; the handoff's "Current state" is refreshed at phase checkpoints (gates 29/34/44) and at phase end.
Task 3a: fix round 1 → bd0f0ab (sr-only price voice, no 0% tag, edge tests, phone stamp, forced-colors). CHANGELOG now on main → asked #71 and #68 to merge main and add their own CHANGELOG/docs lines before review/merge. Rx aria-label not added (would replace the visible 'Rx' accessible name) — accepted.
Task 3a: fix round 1/5 (1I + rulings addressed). Merged PR #71 (with CHANGELOG + docs). Minor (deferred): price-source regex claim overstated; AGENTS.md long line.
Task 3b: opening (resume a65afd8e78b0ef758) with the /dev 404 carry.
Task 7b: pre-merge commits re-reviewed (5/5 + docs/changelog ADDRESSED; literal price pins 38700 kept). PR body size corrected by controller. Merged PR #68. Task 7: complete (#60, #68).
Next free tasks once 3b merges: 4, 5, 6 (need 3) and 9 (needs 3, 7, 8). Track B (aarvion-wt-b) free now → Task 9 waits on 3b; meanwhile nothing else unblocked on track B.
#68 hit a CHANGELOG/docs conflict after #71 merged (parallel PRs all add [Unreleased] lines). Implementer resolving via merge commit.
  Ruling: CHANGELOG.md gets git's union merge driver (.gitattributes) so local merges of origin/main keep both sides; AGENTS.md DoD says to check for duplicates — PR #73 (controller bookkeeping) — cost: occasional duplicate line to spot.
Task 7b: conflict resolved by merge commit d8fc9d3 (both CHANGELOG sides kept). Merged PR #68 (after #73). Task 7: COMPLETE.
Task 3b: split → 3b1 PR #74 (Button/ButtonLink, 192 lines, green); 3b2 local (e7832b4 /dev/styleguide, 0d41cea proxy.ts real 404 for /dev/* when mocks forbidden + docs). #72 (combined) closed as superseded, branch kept.
  Ruling: src/proxy.ts (Next 16 proxy) returns 404 for /dev/:path* when isMockForbidden(); pages keep requireDevRoute() as a second guard; `export const instant = false` verified as a real Next 16 export — accepted.
Task 3b1: review dispatching (sonnet).
Task 3b1: review (sonnet) spec ✅, needs fixes 0C/2I/5M — I1 busy submit button still submits via keyboard/implicit submission (checkout double-order risk); I2 architecture.md styles row stale. Fix round 1 dispatched.
Task 3b1: fix round 1/5 (2I addressed; spec-verified implicit-submission cancel). Merged PR #74.
Task 3b2: opening (resume a65afd8e78b0ef758). Task 9: dispatching (track B, aarvion-wt-b).
Task 9: dispatched (aaf9754c94bd1214f, sonnet, track B). Carries: metadataBase; footer links/logo; container rule 11; C11 owner action docs.
Task 3b2: PR #75 (232 lines, green): styleguide + src/proxy.ts 404 for /dev/* + Button 'use client' (latent bug from #74 fix: event handler from server page). Review dispatching (sonnet).
Task 3b2: review (sonnet) spec ✅, needs fixes 0C/1I/4M — I1 'use client' on all of button.tsx makes buttonClass/ButtonLink client-only; split. Proxy 404 security verified (matcher scoped, case/encoded variants can't reach dev pages). Fix round 1 dispatched (+ no-store on 404, status test, docs).
Task 3b2: fix measured 412 with #75 → split: #75 reverted to its reviewed 232-line state; fix 619a046 (server-safe buttonClass/ButtonLink, Button.client, proxy no-store + noindex, docs) goes in an immediate follow-up PR.
  Ruling: merge #75 now (reviewed, correct; the open Important is bundle/design, not correctness) and land the follow-up next as Task 3b2 fix round 1 — cost: main briefly has a whole-file client button.
Merged PR #75.
Minor (deferred → phase-end review): local MongoMemoryServer startup failures recur when several worktrees run int tests at once (per-worker port blocks collide across worktrees); CI unaffected.
Task 4: dispatched (af982a3c9b4899aa6, sonnet, track D wt-d). Task 5: dispatched (a479c3d5198e6727d, sonnet, track E wt-e). Track A busy with the button follow-up; Task 6 next on A. Track B: Task 9.
Rate limit hit (all agents) — resumed after reset: Task 4 (af982a3c9b4899aa6), Task 5 (a479c3d5198e6727d).
Task 3b2 fix: follow-up PR #77 (195 lines, green). Scoped re-review dispatching.
Task 9: DONE_WITH_CONCERNS — split: 9a PR #76 (site config + prod legal assertion + route map + metadataBase; 313 lines; green); 9b 6065c6a (store footer + brand, 366 lines; reads live categories → owner seeds Preview before it merges into a Vercel-connected repo); 9c a88a663 (Operate shell). Footer follows ruling 10 (reversed logo, no PHARMACEUTICALS). Review of 9a dispatching.
Task 3b2: fix round 1/5 via #77 (I1 + 3 minors addressed). Merged PR #77. Task 3: COMPLETE (#71, #74, #75, #77).
Task 6: dispatched (track A, sonnet). Lockfile ruling: on conflict, take main's pnpm-lock.yaml and re-run pnpm install, commit (merge commit, never rebase).
Task 5: split → 5a PR #79 (text field + forms.css, 297 lines, green); 5b f3ee3f5 (checkbox + segmented, 230 lines) on feat/ui-fields-b-prep. #78 closed as superseded (branch kept). Review 5a dispatching.
Task 9a: review (sonnet) spec ✅, needs fixes 0C/1I/6M — I1 generateMetadata calls getEnv() (whole-env validation) so any bad env var breaks every page incl. 404; make metadataBase resolution total. Fix round 1 dispatched (resume aaf9754c94bd1214f). Carry → H4: call the legal assertion gated on VERCEL_ENV=production; APP_URL required (not localhost) in production.
Task 5a: review (sonnet) spec ✅, needs fixes 0C/2I/5M — I1 field box duplicated ×3 (ruling: shared .field-box class, C12-compatible); I2 no visible focus in forced-colors (outline:none). Fix round 1 dispatched (resume a479c3d5198e6727d).
Task 4: split → 4a PR #81 (overlay styles, dialog primitives, phone drag-dismiss hook; 340 lines; green); 4b 3593edd on feat/ui-overlay-b (Overlay dialog + side sheet + styleguide demo + behaviour tests, ~370). #80 closed as superseded (branch kept).
  Accepted: radix-ui/bogus `cn` from the shadcn CLI removed (only @radix-ui/react-dialog); aria-modal added (Radix omits it); Overlay restores focus to a non-Trigger opener; postcss devDependency for the scrim CSS test.
Minor (deferred → docs): `next dev` rewrites AGENTS.md (inserts an agent-rules block) — find the Next 16 setting to disable it or document "revert it" in AGENTS.md/setup.md.
Task 4a: review dispatching (sonnet).
Task 9a: fix round 1/5 (1I + 6M addressed). Merged PR #76. 9b (footer, reads live categories) next on track B.
Task 4a: review (sonnet) spec ✅, needs fixes 0C/2I/11M — I1 drag snap-back replays the entrance animation (is-dragging removed too early); I2 AGENTS.md map missing ui/ and overlay/. Fix round 1 dispatched with minors (second-pointer guard, refused-dismiss snap-back, reduced-motion snap-back).
  Ruling: Markdown docs COUNT toward the 400-line cap (owner flagged a docs PR failing pr-size; cap kept) — supersedes the plan's docs exclusion — cost: more splits.
Carry → 4b: drag handlers stay on the sheet head (that is what satisfies the nested-scroller rule); doc it.
Minor (deferred): --color-forest-950 is rgb(14 30 21) vs DESIGN.md's rgb(9 22 15) — doc drift to reconcile at the phase-end review.
Task 5a: fix round 1/5 (2I + 5M addressed). Merged PR #79.
Carry → login/address forms (A5, R/K): a submit that invalidates many fields must not fire many assertive role="alert"s at once — use an error summary that takes focus, and per-field errors without role=alert in that case.
Carry → 5b: Checkbox error gets role="alert"; .select/.textarea consumers add `field-box`.
Task 5b: opening (resume a479c3d5198e6727d).
Task 9b: PR #82 (366 lines, green). Union driver garbled CHANGELOG lines on cherry-pick (cleaned by hand). Review dispatching (sonnet).
Task 9b: review (sonnet) spec ✅, needs fixes 0C/1I/7M — I1 brief's VISUAL check (footer vs prototype) not run. Also CONFLICTING with main.
  Ruling: the footer payment line is driven by siteConfig.onlinePayments (default false → "Cash on delivery") — online payments stay hidden until live Razorpay keys exist (plan Stage 6); no claim of UPI/cards/netbanking before then — cost: one go-live flag flip.
  Ruling: local visual checks on non-3100 ports (PORT=3200 pnpm start) so tracks don't collide.
Carry → 9c: root layout renders the footer on every route — admin/staff need a route group or layout split.
Task 6: split 3-way (850 lines) → 6a PR #83 (toast + polite live region, 380 lines, green); 6b d8e3a97 (OTP field); 6c e585bc0 (caret autofill guard + styleguide demo). Unsplit on feat/ui-otp-toast-full.
  Accepted: native paste listener — input-otp inserted a pasted full code at the caret ("48"+"482913"→"484829") in a real-browser e2e; full 6-digit pastes now replace the value. 16px pinned with !important (input-otp sets font-size inline). Stray npm `cn` + lucide import removed from the generated file.
  Note: agent's `pkill` was denied — a local `pnpm start` may linger on :3000 (surfaced to the owner, not killed by the controller).
Task 6a: review dispatching (sonnet).
Task 6a: review (sonnet) spec ❌, needs fixes 0C/3I/6M — I1 toast action kills the toast it raises; I2 action button 40px (<44); I3 duplicate LiveRegion mounts → duplicate #live. Fix round 1 dispatched (resume af97920ef03e5e354).
Task 4a: fix round 1 → #81 now 287 lines (styles + primitives); hook + tests moved to feat/ui-overlay-hook (bed857a) because docs count and the fix took #81 to 556. Overlay (3593edd) imports the hook → next PRs: hook, then Overlay (split again if >400). Scoped re-review dispatching (covers #81 and bed857a logic).
Task 4a: fix round 1/5 → #81 ADDRESSED (hook moved out; CSS open-animation-only suppression; AGENTS map). PR body corrected by controller. Merged PR #81.
Hook (bed857a): re-review found the replay persists (removing is-dragging while open re-arms sheet-up-in) — fix round 2 dispatched with the hook PR (feat/ui-drag-dismiss); e2e for getAnimations after snap-back to ride with 4b's demo.
Task 6a: fix measured 545 with #83 → Ruling (b): merge #83 as reviewed (no consumer of toast/live region yet) and land fix 14bc46c as an immediate follow-up PR against main, re-reviewed there — cost: main briefly carries the 3 known toast defects with no caller.
#83 merge attempt failed: conflicts (main moved with #81). Corrected the agent: merge main into #83 first, then I merge, then the fix PR.
Task 5b: PR #84 (335 lines, green): checkbox (role=alert) + segmented radiogroup (roving tabindex, arrows wrap, Home/End). Review dispatching (sonnet).
Task 5b: review (sonnet) spec ❌ (stale duplicate #79 CHANGELOG line from the union merge), 0C/3I/8M. Fix round 1 dispatched.
  Ruling: REVERT the CHANGELOG union driver (#73) — it silently re-added stale/garbled lines twice (#82, #84); plain conflicts resolved by hand per the new AGENTS.md rule — PR #86 — cost: more visible conflicts.
Task 6a: #83 merged main (77fc7c6), merged PR #83. Fix 14bc46c next as its own PR.
Task 9b: fix round 1 → #82 397 lines (visual check done at 4 widths, matches prototype; COD-only payment line + no-claim test); onlinePayments flag + ROUTES anchors deferred to 9b2 (inverse commits 1de2477, ed4a381). Scoped re-review dispatching (incl. checking dbd7ef7 'compact' didn't weaken the test).
Task 4 hook: PR #85 (315 lines, green): is-dragging persists while open (only inline transition cleared); transitionend target/property guard; 11 hook tests. Review dispatching (sonnet). 4b (Overlay) rebuilt from main after #85; Playwright getAnimations() check rides with 4b.
Task 9b: re-review clean (all findings addressed; M7 deferred to 9b2; dbd7ef7 equivalent). #82 CONFLICTING again → merge main requested. Next on track B: 9b2 (revert of 1de2477+ed4a381) then 9c.
Task 4 hook: fix round 2/5 — all hook findings FIXED (is-dragging persists while open on every path). Merged PR #85.
Carry → 4b: test onLostPointerCapture; Playwright getAnimations()===0 after snap-back on the styleguide demo; paste command output in PR bodies (Global Constraints).
Task 4b: opening (resume af982a3c9b4899aa6), rebuilt from main, split if >400.
BLOCKER (2026-11-19 ~11:36): GitHub Actions blocked by billing ("recent account payments have failed or your spending limit needs to be increased") — every CI job fails in ~3 s. Owner action. Merges paused (merge gate needs CI). #86 (pr-size pending), #82 (b8f12a6, 393 lines) blocked. #87 got green CI just before the block (11:34) → mergeable after its scoped re-review.
  Ruling: do NOT merge on local evidence without the owner's OK; keep implementing and reviewing; agents run the full local gate and paste output into PR bodies.
Task 6a fix: PR #87 (202 lines, green before the block). Scoped re-review dispatching.
Task 6a: fix round 1/5 via #87 (3I + 6M addressed; strict-mode handover race-free). CI was green before the billing block. Merged PR #87.
Task 5b: fix round 1 → #84 exactly 400 lines (folded overlapping tests, compacted demo — re-review checks no assertion lost); local gate pasted (CI blocked). Re-review dispatching. Task 6b dispatched (resume af97920ef03e5e354) — local gate only.
Task 4b: split → 4b1 PR #88 (Overlay dialog + side sheet, 320 lines, local gate green, no CI — billing); 4b2 7dcabda (styleguide demo + phone Playwright getAnimations check, ~130 lines).
  Ruling: Radix's aria-hidden on siblings + its focus trap stand in for DESIGN.md's "inert" (brief's test asserts aria-hidden) — accepted — cost: AT-only hiding, focus still trapped.
Task 4b1: review dispatching (sonnet).
Task 5b: re-review — I1–I3 + minors ADDRESSED; N1 lost assertion in a test fold (owner's no-trim rule), N2 CONFLICTING. Ruling: move the styleguide demo to a follow-up PR to make room; restore the assertion and the shortened demo strings. Fix round 2 dispatched.
Task 6b: PR #89 (OTP field, 319 lines, local gate green incl. e2e; CI blocked). Review dispatching (sonnet).
Task 4b1: review (sonnet) spec ✅, approved 0C/0I/4M; pre-merge commit requested (a11y name separator, returnFocusTo prop, accurate PR body, stale docs). Merge waits on CI (billing).
Task 5b: fix round 2 → #84 365 lines (assertion restored, demo moved out to a follow-up; saved at task-5-forms-demo.tsx.txt). Scoped re-review dispatching.
Task 6b: review (sonnet) spec ❌, 0C/1I/5M — I1 full-code paste listener (the 484829 bug fix) sits in 6c, not 6b. Ruling: move the paste listener + a partial-then-full paste test into 6b; C18 caret guard stays in 6c. Fix round 1 dispatched.
Task 5b: fix round 2/5 — N1, N2 ADDRESSED; PR body corrected by controller. #84 READY (awaits CI).
Task 4b1: pre-merge polish ea6c072 (a11y name separator, returnFocusTo + tests, accurate PR body, docs; 368 lines; local gate green). Accepted without re-review (minor-only polish on an approved PR). #88 READY (awaits CI).
QUEUE awaiting CI (billing): #82 (9b), #84 (5b), #86 (union revert), #88 (4b1), #89 (6b, fix round 1 in progress). Next once merged: 4b2 demo (7dcabda), 5b demo (task-5-forms-demo.tsx.txt), 6c (e585bc0), 9b2 (revert 1de2477+ed4a381), 9c; then 10–15.
  Ruling: hold new task dispatches that depend on unmerged work (10+ need 6/9) — avoid a pile of conflicting stacked PRs while CI is down.
Task 6b: fix round 1 → d95606b (paste replaces partial value, ariaLabel, anchored pattern, matchMedia test; 398 lines; local gate green). 54px ≤400px rule carried into 6c (ruling: fold, not a separate PR). Scoped re-review dispatching.
Task 6b: fix round 1/5 — I1 + minors ADDRESSED; anchored pattern ^[0-9]*$ verified correct (input-otp uses it as an unanchored RegExp filter). #89 READY (awaits CI).
Carry → 6c: 54px boxes ≤400px; test that the paste listener is removed on unmount. Carry → DESIGN.md (doc pass): OTP pattern is ^[0-9]*$ because input-otp treats it as a regex filter.
QUEUE awaiting CI: #82, #84, #86, #88, #89 — all reviewed and ready.
OWNER (2026-11-19): made the repo PUBLIC to restore free Actions. CI reruns triggered for #82, #84, #86, #88, #89.
  Consequence: branch protection is now available on the free plan (was 403 when private) — owner's call (CLAUDE.md: ask before changing branch protection); offer it. Everything in the repo is public: keep personal data and secrets out (already the rule).
OWNER: "Yes, protect main". Applied branch protection on main (nine required checks by name, strict off, linear history, no force pushes/deletion, no reviews, admins not enforced). Docs PR #90 (repo.md, ci.md, AGENTS.md, handoff, merge-gate --admin for ruled ALLOW_OVERSIZE). Local merge-gate synced.
  Ruling: strict (require up-to-date with main) OFF — with parallel tracks it would force a main-merge after every merge — cost: a PR can merge with checks from a slightly older base; the merge gate + post-merge CI on main catch breakage.
Queue: #88 merged; #86 blocked (stale pr-size check) — rerun; #89, #84, #82 in the background queue.
Queue: #86, #88 merged. #89, #84, #82 CONFLICTING after those merges → implementers merging main (no force-push). #90 (protection docs) pending checks.
Merged PR #90 (protection docs).
Task 5b: merged PR #84 (after main merge ae0d1ea). Task 5: COMPLETE except the forms demo follow-up.
Task 5 demo: PR #91 restores the demo reviewed inside #84's first round (moved out for size) — Ruling: merged without a new review (restore of already-reviewed content, original strings). Task 5: COMPLETE (#79, #84, #91).
Task 9b: merged PR #82 (store footer + brand). 9b2 dispatched (resume aaf9754c94bd1214f).
Task 4b2: dispatched (resume af982a3c9b4899aa6) — overlay demo + phone getAnimations check.
Task 6b: #89 merge FAILED (conflicting after #91–#93); 9b2: PR #92 (72 lines, green) — quick review dispatching.
Task 4b2: PR #93 (overlay demo + phone getAnimations e2e, 132 lines, green) — merged on green (demo + test carry from the reviewed hook). Note: local 'pnpm build' needs MONGODB_URI since the layout reads categories (C11) — documented build requirement.
9b2: review clean (0C/0I/3M). Merged PR #92. Carry → go-live: visually check the footer's true-state payment line. Next on track B: 9c (Operate shell).
Task 9c: PR #94 (Operate shell + (store) route group; root layout keeps Toaster + one LiveRegion; 253 lines; green). Review dispatching (sonnet).
Carry → Task 12 (404/error pages): the root 404 now sits outside (store) and shows no store footer — decide the 404's chrome (root not-found catches unmatched URLs; a group not-found only catches notFound() inside the group).
Task 6c: dispatched (resume af97920ef03e5e354) with the 54px + paste-unmount-test carries.
Process: a backgrounded merge-gate result was misread (#89 not merged). Ruling: after any backgrounded merge, confirm with gh pr view <n> --json state before reporting or dispatching dependants.
Task 9c: review (sonnet) spec ❌, 0C/2I/6M — I1 phone (≤720px) shell rules not ported (plan-mandated line range; ruling: prototype wins); I2 stale deploy.md/CHANGELOG. Fix round 1 dispatched.
Task 6b: merged PR #89 (confirmed MERGED). Task 6c dispatched (hand-port of e585bc0; remove the stale duplicate #83 CHANGELOG line).
Task 9c: fix round 1 → daed848 + main merge (720px shell block + test, visual check at 390 on port 3211, docs fixed, duplicate #83 line removed; 315 lines). Scoped re-review dispatching.
Task 6c: PR #95 (180 lines, green; caret beforeinput guard + one paste listener + 54px rule + OTP demo + e2e). Review dispatching (sonnet).
Task 9c: fix round 1/5 (I1, I2 + minors addressed). Merge attempted for #94 (state confirmed below). Task 9: COMPLETE once #94 is MERGED (#76, #82, #92, #94). Carry → next handoff refresh: handoff.md:71 '9c not opened' is stale.
Task 9: COMPLETE (#76, #82, #92, #94).
Dispatched in parallel: Task 10 store header (ac4c43be0e2897cd8, sonnet, wt-b, visual port 3221); Task 13 privacy+terms (add6546132ebaf580, opus, wt-d, port 3231); Task 38 signup consent + session route (a3372c050cf179e22, opus, wt-e — security-critical: C1/C5/C6/C27). Task 6c (#95) in review.
  Ruling: each track's local visual server uses its own port (3221/3231/…) — never 3100 (CI e2e) — and stops its server when done.
Task 6c: review (sonnet) spec ❌ (trivial), 0C/1I/5M — I1 missing id=styleguide-otp. C18 guard verified correct. Fix round 1 dispatched.
Task 6c: fix round 1/5 (id + minors); #95 merge result confirmed below. Task 6: COMPLETE when #95 MERGED (#83, #87, #89, #95).
Task 10: split → 10a PR #96 (announcement bar, 190 lines, green); 10b 63fa1a1 (sticky store header ~350). Chrome mounted in (store)/layout.tsx (not root) — accepted (admin/dev get no store chrome, consistent with #94). Scroll padding = one rule in base.css. Visual check at 1440/390 matched the prototype (on the full state).
Minor (deferred → phase-end): int auth-otp-send/verify flaked once locally again (MongoMemoryServer contention across worktrees); CI fine.
Task 10a: review dispatching (sonnet).
Task 10a: review (sonnet) spec ✅, approved pending CI on head (0C/1I/5M) — #96 CONFLICTING after #95, so no PR checks ran on 075fa83. Merge-main requested. Carry → 10b visual: check 721–800px announce wrap.
Task 10a: merged #96 (confirmed below). 10b next.
Task 10b: PR #97 (sticky header, 381 lines, green; visual 1440/760/390 matches; announce bar stays one line 721–800). Review dispatching (sonnet).
Task 10b: review (sonnet) spec ❌, 0C/2I/4M — I1 Sign in loses its accessible name ≤1100px; I2 /login missing from PENDING_ROUTES. Fix round 1 dispatched. Carry → home tasks: add the #medicines skip-link target.
Task 13: split 3-way → 13a PR #98 (legal layout + prose styles + claims helper, 267 lines, green); 13b privacy (f6b7eba, 6fb60a7); 13c terms (210bd70, 7dee9bc) — local, open after #98.
  Ruling: Terms states the Rx rule ("a medicine that needs a prescription is sold only against a valid one"), not "every listed medicine needs one" — C25 data-independence wins over the brief wording.
  Ruling: Terms' "Online payment is not available yet; cash on delivery only" line is driven by onlinePayments=false — truthful today; flips with the flag. Owner should know Razorpay's reviewer will see it (it changes the moment the flag flips at go-live).
  Ruling: copy-only "To be added" facts (storage location, retention, liability, governing law) are documented as owner actions 23–24 and in deploy.md, since assertLegalConfigComplete can't see page copy.
Carry → Task 14: /legal/grievance and /legal/returns-cancellation must exist (or be in PENDING_ROUTES) before the link test lands.
Task 13a: review dispatching (sonnet).
Task 13a: review (sonnet) spec ✅, approved w/ 1I (plan-mandated: findClaims doesn't enforce C25) + 9M. Ruling: add a C25 guard pattern with an explicit data-derived allRx opt-out; tune /guarantee/ for negated disclaimers; fix AGENTS/testing.md overclaim; style ol. Pre-merge commit requested.
Task 10b: fix round 1/5 — 2 one-line fixes + test; controller verified the 12-line diff directly (Ruling: trivial fix diff checked by the controller instead of a reviewer seat — cost: none material). #97 merge state confirmed below. Task 10: COMPLETE when MERGED (#96, #97).
Task 10: COMPLETE (#96, #97). Dispatched: Task 11 category bar (af9668114d355d8be, wt-b, port 3241); Task 15 cart store (a566e9c31ca11db30, aarvion-build, e2e allowed).
Task 11: PR #100 (category bar + chip row, green; visual matches at 1440/390). Review dispatching (sonnet).
Task 13a: pre-merge fix 36427d9 (C25 guard + allRx opt-out, negated guarantee allowed, docs, ol) + main merge; CI green a16f5af. Scoped re-review dispatching (regex false-negative/positive probe).
Task 38: split 3-way (~810) → 38a PR #99 (spendAndCompare, non-consuming check, name+consents on insert, C6 try/catch, C5 test updates; 314 lines; green); 38b 256c69c+6c5a465 (consent with first verify + GET /api/auth/session); 38c fb539f7 (409 signup_required + C1 parity tests).
  Ruling: consents.channel = the OTP channel (phone/email) used when consenting — accepted (records how consent was captured).
  Carry → account phase (P/A): re-consent when POLICY_VERSION changes; pre-launch users have no consents (none are real yet).
Task 38a: review dispatching (opus — security-critical auth path).
Task 15: split → 15a PR #102 (session cart store, 248 lines, green); 15b 5c67f24 (CartControl, CartPill, wiring). #101 (combined) closed as superseded, branch kept.
  Ruling (carry → 15b): drop aria-live from the stepper <output>; announce cart changes only through the single polite #live region (DESIGN.md: one live region per page) — cost: none.
Task 15a: review dispatching (sonnet). Task 38a: review dispatching (opus).
Task 13a: re-review — all addressed; C25 guard has partial recall (slip-through e.g. "You need a prescription for all medicines") — Minor, deferred to phase-end (add the reverse-order pattern). #98 merged (state above).
Task 11: review (sonnet) spec ✅ approved 0C/0I/5M. #100 merged (state above). Minor (deferred): mobile chip-row focus ring clipped ~3px; .catbar.is-stuck shadow under the non-sticky mobile row (both inherited from the prototype); fixtures don't test sortOrder.
Carry → Task 30: aria-current on the active category chip. Carry → plan text: Global Constraints' therapy-word ban conflicts with the owner's category-name ruling (owner wins) — reconcile at phase end.
Task 15a: review (sonnet) spec ✅, needs fixes 0C/1I/6M — I1 no docs/dev entry for src/lib/cart/. Fix round 1 dispatched with minors (prototype-key-safe map, sanitize re-cap, test hygiene).
Task 11: #100 merged after main merge 8acfc63 (2 CSS minors folded into the merge commit — noted). Task 11: COMPLETE.
Task 38a: review (opus) spec ✅ approved 0C/0I/4M. #99 CONFLICTING (testing.md row). Pre-merge commit requested (merge main, challengeId refund-filter test, 38c-forward comments, PR body order).
Task 39: blocked until 38b/38c merge (SignupInput lives in 38c's diff; its type test imports it).
Dispatched: Task 12 error pages (ac4f83faa09ed645b, sonnet, wt-b, port 3251); Task 19 hero banner (a31428e1c584d253f, opus, wt-f, port 3261); Task 14 policies (a05254a8b65d52b8b, sonnet, wt-g, port 3271); Task 20 quick+trust (aa9753b603e50dcdb, sonnet, wt-h, port 3281).
  Ruling (Task 20): trust item 4 subline gated on onlinePayments — false → 'Pay when your order arrives' — no online-payment claim before live keys — cost: one string.
  Ruling (Task 14): prepaid refund sentences written conditionally ('If you paid online, …') — true before and after go-live.
  Ruling: merge order 13b → 13c → 14 (links e2e needs privacy/terms on main).
Task 13b: PR #103 (privacy, 224 lines, green on 077fa64). Review dispatching (sonnet).
Task 13b: review (sonnet) spec ✅ approved 0C/0I/6M; controller checked the 390 shot (OK). #103 MERGED (4d75bd0). 2 copy minors (HMAC jargon, duplicate 'Last updated') folded into 13c.
Task 15a: fix round 1 → e09014e + main merge a8409ac (docs entry, hasOwn/null-proto, sanitise, test hygiene, hook split to use-cart-lines.ts; 284 lines, green). Scoped re-review dispatching.
Task 15a: re-review — round-1 findings all addressed; NEW I (N1): merge a8409ac dropped main's src/styles/ row and duplicated src/lib/ in architecture.md. Fix round 2 dispatched (restore + re-merge main).
Carry → 15b: import useCartLines from @/lib/cart/use-cart-lines; reconcile unknown stored slugs against the catalogue (they count toward the 20 cap); hook test.
Rule (merges): after resolving a docs conflict, verify 'git diff origin/main -- <file>' shows only this PR's lines.
Task 38a: pre-merge commit 38c17aa (main merge, challengeId race test proven to fail without the filter, 38c-forward comments, PR body; 327 lines, green). Controller checked docs 3-dot diff (only own rows). #99 MERGED (7660c22). 38b dispatched (same agent).
Task 12: PR #104 (404 + error pages, 390 lines; DONE_WITH_CONCERNS). CONFLICTING after #103/#99 → no CI; main merge requested. Concerns: shared withStoreChrome() in root not-found (not global-not-found, experimental); retry() not reset() per Next 16.4 docs; EmptyState.title optional; collectConsoleErrors ignores own 404 line + _rsc prefetch 404s of PENDING_ROUTES. Review dispatching (sonnet).
Task 12: review (sonnet) spec ✅ (4 departures accepted: withStoreChrome, retry(), optional title, console ignores) 0C/1I/4M — I1 console ignore masks non-404 statuses. Fix round 1 dispatched with the main merge.
Task 15a: fix round 2 → 6095bac (styles row restored, one src/lib row, main merged; green). Controller verified the docs 3-dot diff (only own lines; trivial docs fix — no reviewer seat). #102 MERGED (71122c6). 15b dispatched (same agent, port 3291).
Task 13c: PR #105 (terms + 2 privacy copy minors, 232 lines, green on efd58fd). Review dispatching (sonnet).
Task 13c: review (sonnet) spec ✅ 0C/1I/4M — I1 terms offers Razorpay unconditionally then retracts it. Fix round 1 dispatched.
Task 38b: PR #107 (consent stored with first verify + GET /api/auth/session; 340 lines; green 1aafafb). Review dispatching (opus, security path).
Task 14: PR #106 (4 policies + contact + links e2e; 373 lines; DONE_WITH_CONCERNS: no COD-cap constant → '₹5,000' in copy; e2e red only on /legal/terms until #105 merges). Review dispatching (sonnet).
PAUSE (usage limit, 2026-11-19): review packages ready but reviewers NOT dispatched — 38b #107: review-7660c22..1aafafb.diff (opus); Task 14 #106: review-7660c22..77c5632.diff (sonnet). Still running at pause: Task 19 banner (wt-f), Task 20 quick+trust (wt-h), Task 12 fix round 1 + main merge (#104, wt-b), 15b (aarvion-build), 13c fix round 1 (#105, wt-d). Resume: check each PR/branch state with gh + git, then continue the loop. Merge order: #105 → re-run #106 e2e → #106.
RESUMED after usage limit: all 5 paused agents resumed; 38b review (ab48bedef07020fed, opus) and Task 14 review (a66b2d57ab514102e, sonnet) dispatched.
Task 12: fix round 1 + main merge → 435 lines → split: 12A PR #109 (pages, chrome, EmptyState + no-title test; 346 lines; green; /_not-found static). Controller verified A = reviewed code minus e2e + 1 test. #109 MERGED (dc91473); #104 closed as superseded. 12B (feat/error-pages-b, 11d31bd: shell e2e + console helper with the 404-only fix + 6-case unit test) to open next.
Task 20: PR #108 (283 lines, green; DONE_WITH_CONCERNS: CSS in src/styles; Rx card is a link; 1280 width scoped; #q not focused). Review dispatching (sonnet).
Task 14: review (sonnet) spec ✅ approved 0C/0I/3M; e2e red = 8 failures all /legal/terms (13c). Minor 1 (customer care Pending → Fact) folded pre-merge; merge after #105 + main merge + green e2e.
Carry → checkout/COD phase: add a SITE_CONFIG COD-cap constant and read it on the shipping page (₹5,000 is copy today).
Task 20: review (sonnet) spec ✅ 0C/1I/3M — I1 search card doesn't focus #q. Fix round 1 dispatched (focus island + test; flag mocked both ways).
  Ruling: store home content width = one root rule '.home { --container-page: 80rem }' (plan's rule), added by Task 20's fix; section-level 80rem overrides are removed. .wrap is not widened globally.
Carry → Task 19 (banner) and Tasks 21–25: consume .home --container-page; no per-section width overrides. Carry → phase-end: optional --container-chrome token for the 4 duplicated min(80rem,…) chrome rules (header, catbar, footer).
Task 12B: PR #111 (shell e2e + console helper 404-only + 6-case test; 90 lines; green). Controller verified the I1 fix and its tests directly (scoped). #111 MERGED. Task 12: COMPLETE (#109, #111). Carry → Task 28: collectConsoleErrors ignores only 404s (own URL; _rsc prefetch of PENDING_ROUTES).
Dispatched: Task 24 ordering steps static (a3cf2e9af1ca1b9d2, sonnet, wt-b, port 3301).
Task 20: fix round 1 → 345cfbe (+ main merge 9ec5635, CHANGELOG 22d6496; 327 lines; green). Scoped re-review dispatching.
Task 15b: PR #110 (CartControl, CartPill, CartReconcile in (store) layout, hook test; 382 lines; green). Review dispatching (sonnet).
Task 20: re-review — all addressed, 0 new C/I, 2M (flag-mock reset not in afterEach; ctrl-click intercepted as prototype). #108 MERGED. Task 20: COMPLETE.
Task 38b: review (opus) spec ✅ 0C/1I/8M — I1 architecture.md states header session fetch as current (Task 43 wires it). Fix round 1 dispatched: I1 + M2–M4 tests + M5 name rejects \p{C} (bidi/zero-width spoofing) + M7 handoff.
  Ruling (M1): session route keeps the full PublicUser as the brief says — /me already returns it to the same user; no added exposure — cost: Task 39's fetchSession maps to { name }.
Minor (deferred → phase-end): M6 cookie re-issue lines duplicated from /me.
Carry → account phase: CONSENT_VERSION covers the policy pages only, not the login consent copy — version the copy too when it changes.
Task 15b: review (sonnet) spec ✅ 0C/2I/7M — I1 <output> is implicit role=status (live region) despite no aria-live; I2 empty known set wipes the cart. Fix round 1 dispatched (+ announce drops, 'Cart, empty', keyboard test).
  Ruling: one-live-region intent (DESIGN.md) wins over the brief's literal output[aria-live] — the count renders as <span>; cost: none.
Minor (deferred → phase-end): CartReconcile component + layout wiring untested; Enter auto-repeat Add→+ runs to the cap; pill hydrated-from-storage test.
Task 13c: fix round 1 → 35eba5b (both payment paragraphs flag-driven; tests both states) + 2 main merges; 251 lines; green. Controller verified the fix diff (scoped, small). #105 MERGED. Task 13: COMPLETE (#98, #103, #105).
Task 14: minor-1 fix f7473f8 (refunds customer care via Fact) + main merge 04f090f; 377 lines; 9/9 green incl. links e2e. #106 MERGED. Task 14: COMPLETE.
Task 24: PR #112 (static How ordering works; 330 lines; green; DONE_WITH_CONCERNS: --space-sec/--perforation scoped on .act-steps). Review dispatching (sonnet).
Task 24: review (sonnet) spec ✅ approved 0C/1I/5M — I1 'Pay online…' / 'Paid online' copy while onlinePayments=false. Fix round 1 dispatched.
  Ruling: same as footer/terms/trust — flag-off copy: step 3 'Pay by cash on delivery', example order 'Cash on delivery'; flag-on keeps the prototype's verbatim lines.
  Ruling: --space-sec and --perforation live on the single .home root rule (prototype :root values), not on .act-steps; dashed rules elsewhere (trust, footer, label) are different patterns and stay as they are.
Task 15b: fix round 1 → 72adf1d (I1 span + live-region test, I2 empty-known guard, drop announcement, 'Cart, empty', keyboard test, store-chrome wiring after #109) = 434 lines, pr-size red.
  Ruling: split, not oversize — #110 keeps controls + pill + I1 + keyboard/hook tests; reconcile (+ I2, announcement, wiring, tests) moves to 15c, opened after #110 merges. Cost: one extra PR.
Task 24: fix round 1 → 224c605 (payment copy gated + both-state tests; tokens on .home; 1440 re-shot: 80→1360, 1280 wide); 356 lines; green. Controller verified the fix diff (scoped). #112 MERGED. Task 24: COMPLETE.
Task 38b: fix round 1 → 120cfd6 (I1 docs; M2–M4 tests; M5 name /^\P{C}*$/u; M7) + main merge 480314b; 400 lines exactly; green. Controller verified the fix diff (scoped). #107 MERGED. 38c next.
  Ruling (carry → 38c): allow U+200C/U+200D (ZWNJ/ZWJ) only between two letters/marks — legitimate in Indic spellings (e.g. Marathi eyelash ra); every other \p{C} stays refused. Cost if wrong: a few rare names refused until fixed (pre-launch, no real users yet).
Dispatched: Task 39 login API client (sonnet, wt-h) — unblocked: SignupInput on main via #107.
Task 15b: split → #110 (controls + pill + I1 span/live-region test + 'Cart, empty' + keyboard/hook tests; 359 lines; green). Controller verified I1 fix + tests and that reconcile is absent. #110 MERGED. 15c (reconcile + I2 + announcement, local feat/cart-reconcile 72adf1d) dispatched.
CORRECTION: #110 merge FAILED (CONFLICTING after #112/#107) — state OPEN, not merged. Main merge requested. 15c not yet dispatched.
Task 15b: #110 MERGED after main merge 8455744 (359 lines, green). 15c dispatching.
Dispatched: Task 17 display helpers + foil pocket (opus, wt-g, port 3311); 15c reconcile (same 15 agent, aarvion-build). Carry → Task 21/22: freshness e2e (P55).
Task 15c: PR #115 (reconcile + I2 empty-known guard + once-only announcement + wiring; 82 lines; green). Controller verified source diff (content reviewed in 15b review + I2 fix). #115 MERGED. Task 15: COMPLETE (#102, #110, #115).
Task 38c: PR #116 (409 signup_required + C1 parity tests + ZWJ/ZWNJ-between-letters ruling; 283 lines; green). Review dispatching (opus).
Task 39: split → A PR #117 (phone + sanitizeNext, 123 lines) + B 8542f9f (api client, on feat/login-api-b-wip). #114 (unsplit, 425) closed as superseded. One review over A+B dispatching (opus: open-redirect guard).
Task 19: split → A PR #113 (hook fixes + slides/fallback; 337 lines; 8/9 + pr-size check-run glitch), B (64204ab, 2ce4a5c: shell + styles; ~391), C (326b585, c16c2be: HeroBanner + LCP; ~330). Combined ref origin/feat/home-banner 90c0f69. One combined review dispatching (opus). Concerns: track aria-live vs single region; footer-logo preload vs LCP; DESIGN.md 4:3 vs 16:9; main id home; chrome +4px at 390.
Task 38c: review (opus) spec ✅ 0C/1I/5M — I1 timing oracle: findUserByIdentifier COLLSCAN (partial $type index unused) before the code check → account enumeration with no challenge. Fix round 1 dispatched: $type filter in both lookups + explain IXSCAN int test + lookup after the code matches if the flow allows; M1–M3 tests/docs; M4 refuse Default_Ignorable (ruling: fix now).
Carry → account deletion phase (M5): the no-signup branch for a known user calls the upserting findOrCreateUserByIdentifier — a user deleted mid-request could be recreated without consents.
Rule (review): any lookup on a partial-indexed field must include the index's partialFilterExpression ($type) or it scans.
Task 39: review (opus) spec ❌ 1C/3I/9M — C1 OPEN REDIRECT: sanitizeNext('/.//evil.com') → '//evil.com' (brief's algorithm gap; Next router navigates off-site); I1 2xx with bad body → ok:true; I2 invalid_request → 'network' misleads; I3 name not trimmed. Fix round 1 dispatched.
  Ruling (plan defect): sanitizeNext builds its output from the resolved URL and rejects outputs starting '//' or '/\\', and applies blocked prefixes to the normalised pathname case-insensitively — safety wins over the brief's letter. Cost: none.
  Ruling: error mapping — send 400→invalid_identifier; verify 400/413 with signup→signup_required; 5xx/403/415/non-JSON→network; 503 delivery_failed as built.
Carry → Task 40: verify 400/413 with signup sent → show nameInvalid on the name field.
Task 38c: fix round 1 → bfefe37 (I1: $type filters + explain IXSCAN test; users read only after a code match, spy test) to #116 (~384); ce2def2 (M2/M3) + f50f38a (M4 Default_Ignorable + M1 unit table) → 38d after #116 merges. Ruling: split approved (466 > 400).
Task 17: split → A PR #118 (display helpers + server-imports guard; 361 lines; green) + B 962278c (Pocket + pocket.css; ~330; local). One review over A+B dispatching (sonnet).
  Ruling (pending review): R1 stamp-mrp nowrap + stamp-top flex-wrap (MRP wraps at 162–168px on 360px phones); R2 port .btn-add span 13px at 719; R3 --perforation defined once on :root (pocket needs it outside .home); --space-sec stays on .home.
Task 39A: re-review (opus) all addressed, 0C/0I/7M; C1 fixed (137 named + 3.8M fuzzed inputs: 0 off-origin). #117 MERGED. 39B to open from 929de19's tree (not a cherry-pick of 8542f9f — N6) with N1–N5 folded.
Carry → Task 42 e2e: /login?next=/.//evil.com lands on /. Carry → Task 41: no maxLength={10} on the raw mobile input. Carry → Task 40: guard missing retryAfterSec (NaN); on verify 'network', call fetchSession() before showing an error (a timeout can hide a real sign-in).
Task 19: review (opus, A+B+C) spec ✅ 0C/1I/5M — I1 one-frame race: hold/pause at the fill's end drops tickEnd → autoplay stops for good. Fix round 1 dispatched (due flag in A; banner.css → src/styles in B; DESIGN.md 16:9 + card-height lines, AGENTS/handoff home text, shared collectConsoleErrors, footer logo lazy in C).
  Ruling: track aria-live via APG liveMode ('off' during autoplay) is an accepted, documented exception to the single-polite-region rule — banner never calls announce().
  Ruling: footer BrandMark loading=lazy (React 19 auto-preloads non-lazy SSR <img>, the footer logo preloaded ahead of LCP slide 1) — folded into 19C.
Carry → Task 28: budgets assert the header logo is the only image preload on /. Carry → Task 22: e2e that every same-page fragment link on / resolves (#medicines, #heart-care, #eye-care exist).
Task 17: review (sonnet, A+B) spec ✅ 0C/2I/6M — I1 second :root in pocket.css (C12 cross-file dup; hygiene test per-file only); I2 R1 must edit stamp.css rules. A has no findings but #118 CONFLICTING → main merge requested; B fix round after A merges.
  Ruling (amends the Task 24 line): --perforation, --perf-v and foil vars defined once in globals.css :root; removed from .home; --space-sec stays on .home.
  Ruling: css-hygiene checks selector repeats ACROSS src/styles/*.css (C12) — in 17B if it fits, else its own PR.
Carry → Tasks 22 and 30: pocket width ≥ 164px.
Task 39B: with N1–N5 folded = 433 lines. Ruling: split at the seam → B1 (call helper + sendCode + send tests + N1 + N5) now; B2 (verifyCode, fetchSession, SignupPayload pin + tests) after B1 merges. Content already reviewed; controller verifies each against 929de19 + the N fixes.
Task 39B1: PR #119 (call helper + timeout fallback + sendCode + N1 + N5; 224 lines; green). Controller verified N1/N2 diffs vs reviewed 929de19. #119 MERGED. B2 (21b2895 tree) next.
Task 38c: re-review (opus) I1 fixed, 0C/0I/5M (8 scratch int probes: no users read on any failure path; 70 race trials → exactly one session; cap holds). Controller corrected PR body order (N5). #116 MERGED. 38d next with N1–N4 folded (spy watches all users methods + positive control; returning-user race test hitting login.ts:205-206; AGENTS.md consume-after-lookup line; docs/decisions/rulings.md:155 order).
Task 17A: #118 MERGED (890ffee). 17B next.
Task 39B2: PR #120 (verifyCode, fetchSession, SignupPayload pin; 218 lines; green). Controller verified api.ts + api.test.ts byte-identical to reviewed tree 21b2895. #120 MERGED. Task 39: COMPLETE (#117, #119, #120).
Dispatched: Task 21 bento (sonnet, wt-b, port 3321); Task 35 search API (sonnet, wt-d); Task 40 login machine (sonnet, wt-h, with the 3 Task 39 carries + nameInvalid copy key).
  Ruling: Task 40 adds LOGIN_COPY.nameInvalid (server refused signup name) — the brief's copy list predates the name rule.
Carry → Task 22 (rails): ship the freshness e2e (P55) and the same-page fragment-link e2e (#medicines, #heart-care, #eye-care).
Task 19A: fix round 1 → 491af81 (due-tick reducer + tests) + 70d50cb (M1); 400 lines; green. Controller verified the reducer fix + tests (scoped). #113 MERGED. 19B (c2422d5 branch: 64204ab, 2ce4a5c, b3588b1) next, then 19C.
Task 38d: PR #121 (M1–M4 + N1–N4: 7-method users spy with positive control, returning-user race + lost-consume tests (mutation-checked), Default_Ignorable name rule, rulings.md order; 206 lines; green). Controller verified the regex in node (11 cases) and the src diff. #121 MERGED. Task 38: COMPLETE (#99, #107, #116, #121).
Task 35: PR #123 (search API; 221 lines; green; DONE_WITH_CONCERNS: no RED captured; constants unexported in route.ts). Review dispatching (sonnet).
Task 35: review (sonnet) spec ✅ approved 0C/1I/8M — I1 setup.md 429 row lacks the search limit. Fix round 1 dispatched (+ export constants, pure searchProducts, cap test, whole-token strength test).
Carry → Task 36: debounce the combobox; never retry on 429 (60/min reachable in ~12 s of fast typing).
Carry → Phase H: q travels in the URL, so hosting/CDN access logs record searches — cover in the privacy copy and the deploy runbook (log retention).
Task 19B: PR #126 (carousel shell + banner.css in src/styles; 388 lines; green). Controller verified src files byte-identical to reviewed c2422d5. #126 MERGED. 19C next.
Task 35: fix round 1 → d4d97bb + main merge 984e7a1 + c261d64 (setup row comma); green. Controller verified the refactor. #123 MERGED. Task 35: COMPLETE.
Dispatched: Task 36 search combobox parts (sonnet, wt-d) with the Task 35 carries (no retry on 429, debounce, client 64-char cap).
Task 40: split 4-way (865 lines) → A PR #128 (copy + wait formatters; 141; green), B 113d74b (machine, id/send; 340), C 8a8769e (code step errors/limits; 156), D d44369a (sign-up, nameRefused, session check; 263) on feat/login-machine-rest. #125 (all-in-one) closed by implementer. One review over A–D dispatching (opus).
Task 21: split → A PR #127 (home model; 217; green) + B 621d18f (bento; 285) on feat/home-category-bento-b-prep2. Review A+B dispatching (sonnet).
  Ruling: tile list follows shelf order (Sacuwin first) — shelf order is pinned in order.test.ts and the prototype; the brief's string predates it. Cost: one test string.
  Ruling: the .h-section/--spacing-section Tailwind collision gets a root fix (rename the unused spacing token), not a per-heading h-auto! workaround — in 21B if small.
PR #124 merge attempt: MERGED
PR #122 merge attempt: MERGED
PR #127 merge attempt: OPEN
Task 17: #124 (cross-file C12 test; fixed live .label collision — form labels styled as shipping cards) MERGED; #122 (17B pocket + R1–R3 + import guard over src/lib) MERGED. Task 17: COMPLETE (#118, #122, #124). Ledger amend: --perforation now lives on :root (globals.css), not .home.
Task 21: review (sonnet, A+B) spec ✅ 0C/2I/5M — I1 tile-cardio --focus sand-200 ring sits on white (1.36:1) → delete the override (forest-700 default 9.5:1), also in base.css; I2 B's cherry-pick dropped (#127) from A's CHANGELOG line. #127 CONFLICTING → main merge; B fix round after.
  Ruling: --spacing-section rename/move out of @theme static in its own small PR before the close act (Task 25); h-auto! + its test removed there.
Carry → re-check .tile-resp once foil vars are on main (they are, via #122).
Task 36: split 3-way (753) → A PR #130 (highlight + useCombobox; 287; green), B 4560ccb (useProductSearch), C 56e80e8 (SuggestionList + search.css), local. Review A–C dispatching (sonnet). Stray remote branch feat/search-combobox-parts (no PR) — leave; deletion needs owner OK, list in final summary.
Carry → Task 37: pass open = items.length > 0; announce() the result count via #live.
Task 36: review (sonnet, A–C) spec ✅ 0C/4I/8M — I1 IME composition not ignored; I2 render loop (fresh [] each render resets useCombobox); I3 no scrollIntoView for active option; I4 Escape not prevented (native search clear). Fix round 1 dispatched across A/B/C.
Task 19C: PR #129 (HeroBanner + LCP slide 1, DESIGN.md fixes, footer logo lazy; 362; green). Controller verified files identical to reviewed branch. #129 MERGED. Task 19: COMPLETE (#113, #126, #129).
Dispatched: Task 31 product facts + strength switcher (sonnet, wt-f, port 3331).
Task 40: review (opus, A–D) spec ✅ 0C/6I/11M — I1 busy not a guard (stale/duplicate results corrupt state); I2 failed resend leaves a dead code verifiable; I3 resend failure hidden under lock copy; I4 resend lifts daily/network locks; I5 normMobile truncation can send a code to a stranger's number; I6 rest branch not pushed. #128 (A, copy) merge: OPEN.
  Ruling: nameRefused is the new key for a server-refused sign-up name (nameInvalid already existed).
  Ruling (I5, amends Task 39 brief): normMobile strips one leading +91/91/0 and never truncates — any other length is invalid. Fixed in phone.ts within 40B, with tests; identifierOf exported.
  Ruling: failed resend (delivery_failed) → back to the id step with deliveryFailed; resend_cooldown on the id step → go to the code step (a live code exists); profile-step rate_limited gets lockedUntil + tick.
Task 36A: fix round 1 → 77beb1b (IME, Escape preventDefault, equal-items compare, aria-expanded); green. #130 merge: OPEN. B (fed359c, f217bdd) and C (89abe24, a12985d) local in wt-d — open after A.
PAUSE (usage limit): resume points — #128 (40A) needs main merge then merge; 40 B–D fix round running (agent a6ee82a6c2b28ead5); 21A #127 main merge running then 21B fix round; 36B/36C to open; 31 in progress (wt-f). Owner approval needed: delete stray remote branch feat/search-combobox-parts.
RESUMED 2026-11-26. Task 40A: #128 (copy + wait formatters; reviewed in the A–D review, no A findings) merge: MERGED.
Task 40 fix round 1 → B 3194226 (383), C 9b4fef8 (346), D b320def (278) on feat/login-machine-rest (resend moved B→C). Scoped re-review dispatching (opus). 40B PR opening (same agent).
Task 31: PR #131 (origin, facts, switcher; 327 lines; green). Review dispatching (sonnet).
Dependabot PRs #132–#136 opened (minor bumps + jest-dom 7→8 major). Deferred to phase-end: batch-merge the green minors; jest-dom major gets its own check.
Task 31: review (sonnet) spec ✅ 0C/1I/5M — I1 customer care missing from ProductFacts (brief gap). Fix round dispatched (+ marker word boundaries).
Owner note → final summary: country of origin is inferred from North-India address markers; the first manufacturer elsewhere shows 'To be added' until the marker list is extended.
Carry → Task 22: when rails/pockets link to /product/<slug>, add it to PENDING_ROUTES until Task 32 lands (links e2e crawls /).
Hazard: 'next dev' rewrites AGENTS.md with a Next agent-rules block in any worktree — every dispatch must revert it before commit. Consider a phase-end fix (config or .gitattributes).
Task 21A: #127 (home model; 215; green) merge: MERGED.
Task 36A: #130 merge: MERGED. 36B opening.
Task 40: re-review (opus) — fix round 1 mostly addressed; NEW I: N1 (C) resend allowed under daily/network lock spends an SMS on a dead code with no message; N2 (B, #137) normMobile drops non-ASCII digits/letters → a typo becomes a different valid number. Fix round 2 dispatched.
  Ruling (N2): map \p{Nd} to ASCII, reject any character outside digits/space/-/./()/one leading +, then strip the prefix.
Carry → Task 41: the network-lock text is frozen (M3) — render the countdown from lockedUntil.
Dispatched: Task 22 rails (sonnet, wt-g, port 3341) with P55 freshness e2e + fragment-link e2e + /product/ pending carries.
Task 36B: PR #138 (useProductSearch + stable empty + unmount/interplay tests; 360; green). Controller checked the fix (module NONE; per-response arrays live in state). Merge: MERGED.
Task 31: fix round → 5f892c7 (customer care row; marker-only origin with word boundaries and street-word guard; 388; green). Controller checked origin.ts. #131 merge: OPEN.
Task 40: fix round 2 → #137 (B, 383) + #140 (N2 normMobile: \p{Nd}→ASCII, reject stray chars; 58, stacked) + C 5d02fae / D ca8729d on feat/login-machine-rest-v2. Controller verified N2 code. #137 conflicting after #138 → main merge requested.
Owner copy approval needed → final summary: nameRefused, nameTooLong ('Enter a name of 80 characters or fewer.').
Task 40B: #137 merge: MERGED.
PR #140 merge: OPEN
PR #141 merge: OPEN
Task 21B: PR #139 (bento + I1 focus override removed, I2 CHANGELOG, foil print on .tile-resp; 305; green). Merge: OPEN.
Task 31: #131 merge: OPEN (after main merge cbe1c09).
Ruling: serialized merge queue (#131 → #139 → #141 → #140): every PR edits the same architecture.md rows and CHANGELOG top, so parallel main-merges race. Phase-end carry: reduce docs hotspots (e.g. per-folder rows in short lines, or CHANGELOG via changelog.d fragments).
PR #131 merge: MERGED
PR #140 merge: MERGED
Task 36C: #141 (SuggestionList + scrollIntoView + mousedown; 241; green) merge: OPEN. Task 36 COMPLETE if merged (#130, #138, #141).
Task 22: split → A PR #142 (rails plan + component; 247; green) + B 93bbbc0/4174c6e (mount, rails.css, PENDING_ANCHORS, freshness + anchors e2e). Review A+B dispatching (sonnet).
Dispatched: fix/section-token-utility (sonnet, wt-f, port 3351) — move --spacing-section out of @theme static; remove h-auto!/height:auto workarounds once landed.
Merge queue now: #139 → #141 → #142 → 40C.
PR #139 merge: MERGED
PR #143 merge: OPEN
Task 21: COMPLETE (#127, #139). Queue next: #141, then #143, #142.
Task 22: review (sonnet, A+B) spec ✅ 0C/1I/6M — I1 freshness e2e finally can skip cache expiry on failure (stale price leaks to later specs). B fix round dispatched; A #142 queued after #141, #143.
Dispatched: Task 25 FAQ + close (sonnet, wt-b, port 3361); Task 30 category page (sonnet, wt-e, port 3371) with the aria-current carry.
Task 40C: #143 (resend/lock handling, N1/N3/M4; 367) merge: MERGED.
fix: #144 (--spacing-section out of @theme static; Tailwind compile test; removed #139's h-auto! workaround; 73 lines) merge: MERGED.
Agent incident: the token-fix agent killed PID 30085 (a Claude desktop network helper on port 3351) by mistake — rule for dispatches: identify the server PID by the process it started (its own background task), never by port.
PR #145 merge: MERGED
PR #141 merge: OPEN
Task 40: COMPLETE (#128, #137, #140, #143, #145).
Dispatched: Task 41 /login id + code steps (opus, wt-h, port 3381) with all login carries.
Task 25: PR #146 (FAQ + close; 309; local gate green; CONFLICTING so no CI). Review dispatching (sonnet). Reconcile PENDING_ANCHORS (#questions, #faq-win2age) between #146 and 22B — whichever lands second.
Task 25: review (sonnet) spec ❌ 0C/1I/4M — I1 close renders full logo; brief/README/prototype want the mint swoosh (aarvion-mark.svg, 184px) since Task 28 scales it 14×. Fix round dispatched (+ reduced-motion chevron, open <details> on hash).
Owner copy list: FAQ Q4 off-state sentence ('order is not packed').
Task 36C: #141 MERGED. Task 36: COMPLETE (#130, #138, #141). Next in queue: #142 (22A).
Dispatched: Task 37 header search (same Task 36 agent, wt-d, port 3391). #142 (22A) main merge requested — its turn.
Task 22A: #142 merge: MERGED.
Task 25: fix round → 0c3d6ae (mint swoosh img, reduced-motion chevron, FaqHashOpen + tests; 367; green). #146 merge: MERGED.
Task 25: COMPLETE (#146).
Dispatched: Task 32 product page (Task 31 agent, wt-f, port 3331). Task 23 waits for 22B (same rails files).
Task 22B: #148 (mount, rails.css, freshness + anchors e2e with I1 cleanup, PENDING_ANCHORS emptied; 279; green) merge: MERGED. Task 22 COMPLETE if merged (#142, #148).
Dispatched: Task 23 rail controls (Task 22 agent, wt-g, port 3341).
Task 37: split → A PR #149 (HeaderSearch, unmounted; 392; green) + B 3e45a47 (chips, mount in store-chrome, e2e). Review A+B dispatching (sonnet).
Task 23: PR #152 (arrows + interim in-place View all; 310; green). Review dispatching (sonnet).
Task 41: split 3-way (~950) → A PR #151 (LoginFlow + id step; 325; green), B d204922 (code step), C 090adaf (/login page) on origin/feat/login-page. Review A–C dispatching (opus).
Task 37: review (sonnet, A+B) spec ✅ 0C/3I/7M — I1 chips lose click in Safari/Firefox (no mousedown guard); I2 e2e reveal tests can silently pass/skip; I3 stale CHANGELOG. Fix round dispatched.
Task 23: review (sonnet) spec ❌ 0C/2I/8M — I1 focus lost after 'Show fewer' (toggle hidden while focused); I2 open sheet shrink-wraps to one column at 1100. Fix round dispatched (+ visibility:hidden arrows to stop the toggle moving).
Task 41: review (opus, A–C) spec ✅ 0C/1I/10M — I1 C exposes /login before Task 42's profile step exists (new users see an empty card). #151 (A) merge: MERGED.
  Ruling: open 41B now (move the 24-line session-check effect into B so B is self-contained); HOLD 41C (/login page + PENDING_ROUTES removal) until Task 42's profile and done steps merge — 42 and 41C may ship together.
Carry → Task 42: TextField/Checkbox prop to turn off role=alert, a focused error summary on a multi-field invalid submit, with a test.
Owner copy list: viaLegend 'Send the code to my'.
Task 23: fix round → fc43454 (no measure while open + regression test; open sheet width 100%; data-off visibility arrows; unmount test; 358; green). Controller viewed the 1100 open shot (4-col grid). #152 merge: OPEN. Task 23 COMPLETE if merged; Task 30 replaces the toggle with a link.
Task 37A: fix efff14b (chips pointer/mousedown guard + test) + main merge; 400 lines; green. #149 merge: MERGED.
Task 23: #152 merge: OPEN (after main merge a5c1870). Task 23 COMPLETE if merged.
Task 23: #152 merge: MERGED (927a861).
Task 23: COMPLETE (#152). Home sections 19–25 all on main.
Dispatched: Task 28 film motion (Task 22/23 agent, wt-g, port 3341) with all Task 27/12/19 carries.
Task 37B: #156 (mount + chips + e2e without skips + chip Escape fix; 280; green) merge: OPEN. Task 37 COMPLETE if merged (#149, #156).
BUDGET FLAG: first-load JS on / is 164.5 kB gzipped (11 scripts) vs the plan's ≤150 KB (product pages). Carry → Task 28 (home budgets) and Task 33 (product budgets): measure the split and trim (likely candidates: Radix dialog/otp chunks, search island, carousel) before asserting budgets.
Task 41B: #155 (code step + session check with 2 tests; resend moved to C; 371; green) merge: OPEN. #156 (37B) conflicting → main merge requested.
Ruling: restructure docs/dev/architecture.md to one file per line (docs PR, oversize allowed as a pure move with word-multiset proof) — the long folder rows conflict on every parallel PR and cost a CI cycle per merge. Dispatched (sonnet, wt-b). Owner-requested CHANGELOG.md stays as is (its conflicts are trivial).
Task 37B: #156 merge: MERGED. Task 37 COMPLETE if merged.
Task 41B: #155 merge: OPEN. Plan: 42A → 41C → 42B (accepted).
Task 41B: controller merged main into #155 (9d2c9c6; CHANGELOG union, components-row edit re-applied by script). Merge: MERGED.
docs: #157 architecture.md one-file-per-line (263 lines; word-multiset check: only 17 joiners dropped) merge: MERGED. All agents: edit only your file's bullet.
Task 42: split → 42A1 #159 (ErrorSummary, errorAlert prop, done step; 286; green), then 42A2 (profile), 41C (page), 42B (demo/e2e). Review 42A1 dispatching (sonnet).
Incident: Task 30 agent wrote View-all-link edits into wt-h (another agent's worktree); wt-h agent stashed them as stash@{0}. Routed back to wt-e; drop the stash after confirmation. Rule reinforced: absolute paths under your own worktree only.
Task 42A1: review (sonnet) spec ❌ 0C/1I/6M — I1 no unmount/StrictMode timer test. Fix dispatched (+ modifier clicks, smooth scroll unless reduced motion). Done-step CSS must land by 41C. Owner copy list: 'There’s a problem' / 'There are N problems'.
Task 28: split 3-way (~950) → A PR #158 (engine minors; 141), B af74589 (FilmRoot/engine wiring/film.css/e2e), C ba5aeb1+7879989 (deferred slides 2–4, home budgets). Review A–C dispatching (opus).
  Ruling (JS budget): home first-load 170.3 kB gz vs 150 target; ~120 kB is React DOM + Next client baseline. Assert a ratchet at 175 kB now (explicit, not silent) and add a follow-up task: lazy-load the header search island on first focus/idle and trim the hero chunk, target ≤160 home; product pages keep the 150 target (Task 33 measures). Cost: ~20 kB more JS than planned on mid-range Android until the follow-up.
  Ruling: font count 3 (not 4) is correct — plan text is stale.
Task 42A1: fix 439b339 (unmount + StrictMode timer tests, modifier clicks, smooth scroll unless reduced motion); 364; green. #159 merge: MERGED.
Task 30: split → A PR #153 (category page; 317; green) + B 589a96b/0e5a074/3bde0b0 (aria-current chips, View all → link, e2e). #147 closed as superseded. Review A+B dispatching (opus). Concerns: soft 404 (200 first hit), duplicate chrome on category 404, root children Suspense.
Note: git stash is shared across worktrees; stash@{0} (category B edits, already applied in wt-e) and stash@{1} ('41C wip', login agent's) — leave both; never drop stashes by index.
Task 28: review (opus, A–C) spec ❌ 0C/3I/9M — I1 C's JS budget still fixme and sums content-length (≈0 under gzip); I2 no-JS phones swipe to blank slides 2–4; I3 with JS, film hides content until the engine starts (plan-mandated) → scope hidden states to .film .live. A has no findings: #158 merge: MERGED.
  Ruling (I3, amends the plan): hidden start states apply only under .film .live (acts the engine has armed); an e2e with JS chunks blocked must show tiles and close CTA.
Task 42A2: review (sonnet) spec ❌ 0C/2I/4M — I1 new-tab legal links lack an accessible hint; I2 duplicate CHANGELOG bullet. Fix dispatched. Consent/DPDP probes all pass.
Task 32: split → A PR #154 (product page; 400; green) + B eb5c30a (pocket name link, generateMetadata, search spec cleanup). #150 closed as superseded. Review dispatching (opus).
CONFLICT to rule on: #153 (Task 30) wraps root layout children in Suspense; #154 (Task 32) instead suspends the skip link and changes HeaderSearch to read window.location at click — two different fixes for the same request-time-render problem (usePathname in the chrome). One must win before either merges.
Task 28B: PR #161 (I3 .live gating, blocked-chunks e2e; 368; green). Follow-up requested: pinned-stage layout must also wait for the engine (cards overlap if the chunk fails). C local (I1 real Resource-Timing budget at 175 kB proven by a 1 kB fail; I2 noscript pictures).
Task 30: review (opus) spec ❌ 0C/4I/7M — I1 soft 404 → ensureStatic='navigation' (tested: first hit 404); I2 duplicate chrome on category 404 → body-only (store)/not-found sharing a body component; I3 root Suspense disables the blocking-route guard → remove, wrap only SkipLink/HeaderSearch/CategoryBarLink if needed; I4 stale docs. Waiting for the Task 32 review to settle one approach for both PRs.
  Ruling (C24): React 19's automatic preload of the eager LCP image (first pocket / product photo) is accepted — C24 forbids Next's preload prop (which drops fetchPriority), not React's own hint.
Task 42A2: fix ed83b2f (new-tab hint via LOGIN_COPY.newTab + tests; dup CHANGELOG removed); 360; green. #160 merge: MERGED. Owner copy list: newTab ' (opens in a new tab)'.
Task 32: review (opus) spec ❌ (soft 404) 0C/3I/6M — I1 CHANGELOG under [0.1.0] with #150; I2 testing.md + usePathname rule undocumented; I3 cross-PR conflict.
  RULING (Tasks 30+32, request-time render): adopt #154's leaf approach — Suspense only around the usePathname caller (SkipLink with a static fallback link; CategoryBarLink with fallback = same link without aria-current); HeaderSearch reads window.location.pathname at click. NO root-layout Suspense (it disables the Cache Components blocking-route guard app-wide). Document the rule in architecture.md.
  RULING (soft 404): both dynamic pages export ensureStatic = 'navigation' (Task 30 reviewer built and verified: first hit 404); add a body-only (store)/not-found.tsx sharing a body component with the root not-found (one chrome on every 404); e2e asserts 404 on the FIRST goto and exactly one header.
  Order: #154 (with I1, I2, ensureStatic, store not-found, first-hit 404 + single-chrome e2e) → 32B (generateMetadata, must land before any deploy) → #153 converge (drop root Suspense, leaf-wrap CategoryBarLink, ensureStatic, union START lists) → 30B.
Task 41C: #162 (/login page, resend busy, Change, auth.css in src/styles, consent link styling; 285; green; built+started visual check end-to-end) merge: MERGED. Task 41 COMPLETE if merged (#151, #155, #162). /login is live on main.
Task 32A: fix round 163c72d (ensureStatic navigation — first-hit 404 verified by curl + e2e; SkipLink fallback; no root Suspense; rule documented; CHANGELOG/testing fixed; 399; green). #154 merge: MERGED. Store not-found moved to 32B.
Task 28B: #161 (film rules keyed on .film.is-running — engine-owned; blocked-chunks e2e asserts visible + disjoint cards; 399; green) merge: OPEN. C (6b6cddf, 130) and D (301f2d7, ~300) local.
Task 28B: #161 merge: MERGED (c8bfac7).
Task 30A: fix round d784bde (root Suspense removed; ensureStatic first-hit 404 e2e; body-only (store)/not-found + shared NotFoundBody → 1 header/1 #q on every 404; docs; 385; green). #153 merge: OPEN. 32B must drop its not-found part (now on main).
Task 30A: controller merged main into #153 (172f6fb, CHANGELOG union). Merge: MERGED.
Task 28C: #166 (slides 2–4 after load + noscript pictures; 130; green) merge: MERGED.
Task 30B: #167 (CategoryBarLink leaf Suspense w/ plain-link fallback; View all link replaces toggle; aria-current e2e; urology visual; 273; green) merge: MERGED. Task 30 COMPLETE if merged (#153, #167).
Task 28D: #168 (budgets e2e: real Resource-Timing 175 kB ratchet; 305; green) merge: OPEN. Task 28 COMPLETE if merged (#158, #161, #166, #168). Follow-up: lazy-load header search island + trim hero chunk, then lower HOME_JS_BUDGET_BYTES.
Task 28D: controller merged main into #168 (2e0cbe9). Merge: MERGED. Task 28 COMPLETE if merged.
Dispatched: Task 29 home finish-review gate (film agent, wt-g, port 3341).
deps: #132 merge: MERGED
deps: #133 merge: OPEN
deps: #134 merge: MERGED
deps: #135 merge: MERGED
deps: #136 merge: MERGED
Task 42B: #163 (demo states behind allowDemo=!isMockForbidden — UI-only; login e2e incl. /.//evil.com → /; noindex; 294; green). Controller checked gating. Merge: MERGED. Task 42 COMPLETE if merged (#159, #160, #163).
Task 32B: #169 (generateMetadata; pocket name link; single-chrome + title e2e; 65; green; cold-build first-hit 404 without 500). #164/#165 closed by implementer. Merge: OPEN. Task 32 COMPLETE if merged (#154, #169).
Task 32B: controller merged main into #169 (3fa3d48). Merge: MERGED. Task 32 COMPLETE if merged.
Dispatched: Task 33 product SEO/sitemap/robots/budgets (product agent, wt-f). Main CI after deps merges: watching.
deps: main CI green with #132 #134 #135 #136 combined (1cf0ce7). #133 (vitest) after rebase: MERGED.
Task 43: split A #171 (dialog; 196) + B 378a315 (pill, e2e). Review (sonnet) spec ❌ 0C/4I/10M — I1 dialog with next never closes, pill stale; I2 Escape at done skips onSignedIn; I3 split unclean (initialFocus in B); I4 focus untested on real flow. Fix round dispatched.
Task 29: PR #170 (finish review inline; 3 fixes: View all arrow, rail head alignment, aside search icon; shoot.mjs --click/--wait; 41 lines). Controller viewed the 1440 capture (store format, banner, quick actions, trust, bento — good). Merge: MERGED. Independent finish review folded into the phase-end review.
  Ruling (JS budgets): product first-load is 166.5 kB vs 150 (shared framework + chrome). Assert a ratchet at 170 kB on product pages now (no fixme). Follow-up task NOW: lazy-load the header search island (first focus/idle) and trim chunks, then lower both ratchets (home 175, product 170) to the measured values.
Task 33: split → A PR #172 (metadata, JSON-LD, sitemap, robots, siteUrl; 350; green) + B f960664 (product budgets, freshness on mucohelp). Review A+B dispatching (sonnet). Dispatched: perf/lazy-header-search (film agent, wt-g).
Task 33: review (sonnet) spec ❌ 0C/3I/7M — I1 product budget fixme; I2 prod siteUrl silently falls back to localhost; I3 raw process.env bypasses getEnv. Fix round dispatched (prod throws EnvError lazily).
Task 43A: fix round 5d78fa6 (close + onSignedIn before push; onSignedIn on close at done; Overlay initialFocus fn; real-LoginFlow focus tests; host ?next ignored in dialog; 340; green). #171 merge: MERGED.
PHASE K+R plan written: docs/superpowers/plans/2026-11-27-phase-kr-cart-prescriptions.md (15 tasks: wave 1 K1, R1, R2, R3 parallel; K2→K7; R4→R7; KR8 gate). Docs PR being opened (plan + rulings.md).
  Ruling: keep K7 cart drawer (spec §5.5). Ruling: R5 fallback if private Blob client uploads unsupported — chunked upload through our route (<4.5 MB parts), reassembled and validated server-side.
Owner list (KR): data residency for Rx files (Blob region); 'Medicines without a prescription' heading; new upload error copy; PDF metadata kept (rebuild deferred to H).
Task 33A: fix round 9a22150 (getSiteEnv: prod throws EnvError lazily when APP_URL missing/invalid; og tags; sitemap+robots moved to C; 364; green). #172 merge: MERGED. Next 33C (sitemap/robots via getSiteEnv), 33B (170 kB product ratchet, freshness).
perf: PR #175 lazy header search (-2.2 kB/page; home 170.8→168.5; product 166.5→164.3; HOME budget 175→171). Review dispatching (sonnet). Owner note: the 150 kB plan target is not reachable without refactoring shared islands; framework baseline ~118 kB.
perf: #175 CLOSED after review (0C/3I/7M; 2.2 kB not worth IME/iOS focus risk). Ruling: the 150 kB first-load target is replaced by ratchets — home 175 kB, product 170 kB — framework baseline ~118 kB; any future reduction must not swap focused inputs. Owner note in final summary.
Task 33: PR #176 merge: MERGED
Task 33: PR #178 merge: OPEN
Task 33B: controller merged main into #178 (bb586f7). Merge: MERGED. Task 33 COMPLETE if merged (#172, #176, #178).
Task 34: PR #183 (product 2-col from 720px; Product details heading scale; 7 lines). Controller viewed category 1440. Merge: MERGED. Task 34 COMPLETE if merged.
  Ruling: the partial last row on one foil sheet stays (reads as a blister strip with empty slots) — owner may revisit.
Task 44: fresh finish review (opus) disposition fix — 1 dialog head swoosh (Overlay mark slot), 2 placeholders restored, 3 mono/tabular countdown digits; optional step transition. Dispatched to the login agent.
Task 43B: #173 (account pill + e2e, fixed-width, Segmenter initial; green) MERGED. Task 43 COMPLETE (#171, #173). Task 44 fix PR next.
Task 44: round-2 verdict ship (3/3 resolved). #190 merge: MERGED UNKNOWN. Task 44 COMPLETE if merged. ALL 44 UI TASKS COMPLETE → UI phase-end review next.
PAUSE (usage limit, 2026-11-27): UI phase — all 44 tasks merged (last #190). NEXT: UI phase-end whole-branch review (base eab1c0b → main 74d7c7d, ~33k lines: review by area, opus), one fix wave, persist rulings to docs/decisions, refresh handoff, delete workspace. In flight: ui-phase minors sweep (abb3597, wt-b).
UI minors sweep: #192 MERGED (agentRules:false stops next dev rewriting AGENTS.md; C25 reverse-order patterns; --container-chrome; catbar order test; DESIGN.md scrim; plan therapy note).
UI PHASE-END: final whole-site review dispatched (opus, read-only worktree wt-review).
UI final review (opus): 0C/7I/15M — I1 handoff ~70 PRs stale; I2 rulings after 11-19 not persisted, no phase-ui-ledger.md, 150 kB text stale; I3 AGENTS/docs/dev stale; I4 header search Enter opens previous query's result (wrong-medicine path); I5 no add-to-cart e2e; I6 CTAs to pending routes + no sign-out → deploy blocker/H4 gate; I7 independent home finish review owed.
  Fix wave: ONE fixer (abb3597, wt-b) for I1–I6 + cheap minors; I7 independent home finish review (opus) in parallel. Security headers → phase H.
UI I7: independent home finish review (opus) disposition fix — false refund copy in ordering step 2 (gate on onlinePayments); uneven mobile step spacing. Both added to the fix wave. Ruling: ragged rail ends at 1440 stay (match prototype). Owner check: real-device motion smoothness.
