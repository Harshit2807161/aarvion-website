# SDD ledger — plan: /Users/harshi/aarvion-build/docs/superpowers/plans/2026-11-16-phase-f-foundation.md

Spec: /Users/harshi/.claude/plans/pasted-content-id-83b6-leave-them-misty-micali.md (approved plan; Stage 4 sub-choices delegated)
Execution adaptation: one PR per task. Each task branches from up-to-date origin/main inside the worktree /Users/harshi/aarvion-build, opens a PR, gets the task review, and is squash-merged by the controller (owner explicitly authorised merging PRs). BASE for each review = origin/main at dispatch.

## Pre-flight scan
| Rows | Produces / consumes | Finding | Ruling |
|---|---|---|---|
| T1 ↔ T3 | T1 health route (db:"skipped") → T3 adds db ping | consistent | — |
| T1 ↔ T2 | T1 scripts lint/typecheck/test:unit/test:int/build → T2 CI jobs | consistent; job ids must equal the branch-protection check names | T2 job ids: lint, typecheck, unit, int, build; title check id pr-title |
| T3 ↔ T4 | T3 getDb/registerIndexes → T4 mock outbox | consistent | — |
| T1 ↔ T4 | T1 Env type lacks SMS_PROVIDER/EMAIL_PROVIDER/PAYMENTS_PROVIDER/FILE_STORE | conflict | Ruling: T4 extends the Env zod schema with those enum keys — env.ts is the single env authority — cost if wrong: trivial |
| T2 ↔ T4 | T4 adds e2e job; T2 protection lists required checks | gap | Ruling: after T4 merges, add `e2e` to required checks via gh api — cost: one API call |
| T1 self | create-next-app into a non-empty repo (README.md, docs/, data/, assets/ exist) | create-next-app refuses or overwrites | Ruling: scaffold in a temp dir, copy in, merge .gitignore, keep and extend README — cost: minor |
| T1 self | tests vs code | consistent (env lazy, health GET) | — |
| T2 self | pr-size excludes + 400 cap | consistent with Global Constraints | — |
| T3 self | health 503 within 4 s vs serverSelectionTimeoutMS 3000 | consistent | — |
| T4 self | e2e smoke needs no DB (health db:"skipped" when MONGODB_URI unset) | consistent | Ruling: e2e CI job runs without Mongo for the smoke — cost: none now |

## Tasks
Task 1: dispatched (BASE 0806966, branch chore/scaffold-next-app, implementer agent a66c774b8304d2068, model sonnet)
Task 1: report DONE_WITH_CONCERNS (c57cf34, PR #2). Ruling: allow sharp native build — later image optimisation and Rx re-encode need it — cost if wrong: slower installs. Concerns 2-5 accepted as observations. Implementer resumed for the sharp fix.
Task 1: fix pushed (636078f). Review dispatched (agent a5c61bf42604dfdae, sonnet) on 0806966..636078f
Task 1: complete (commits 0806966..636078f, review clean: 0 Critical/0 Important, 5 Minor parked). Controller verified the full check locally (exit 0). Merged as PR #2.
  Parked minors → Task 3: make /api/health `dynamic = "force-dynamic"`; read version from package.json import instead of npm_package_version; env import test should also call getEnv(). Commit-type `build:` only in a squashed branch (PR title is chore:), so no action.
Task 2: dispatching (BASE 97352c8, branch ci/pipeline-and-guards)
Task 2: dispatched (implementer agent a4df9e1d3b9c421b7, sonnet). Ruling: controller applies branch protection after merge (repo setting covered by plan approval) — cost if wrong: one API revert.
Task 2: report DONE (PR #3, head ef08f21, CI green). Review dispatching.
Task 2: complete (commits 97352c8..ef08f21, review clean: 0 Critical/0 Important, 8 Minor). Merged as PR #3 (f940c8f). All 8 CI checks green before merge.
  Branch protection: gh api returned 403 "Upgrade to GitHub Pro or make this repository public". Ruling: keep the repo private (going public is the owner's call); enforce the gate at process level — the controller merges only after `gh pr checks` shows every required check passing — cost if wrong: a red PR could be merged by hand; flagged to the owner.
  Carried into Task 3 (minors): dependabot commit-message prefix (chore(deps) / ci(deps)) so the pr-title check passes; set MONGOMS_DOWNLOAD_DIR to the cached path in the int job; cancel-in-progress only for pull_request events; repo.md must say protection is NOT applied (403 on the free private plan) and how to enable it.
Task 3: dispatching (BASE f940c8f, branch feat/db-client-and-indexes)
Task 3: dispatched (implementer agent a28391a9758f3bbf1, sonnet)
Task 3: report DONE (PR #10, head e9e4a5c, CI green, 391 lines). Review dispatching.
Dependabot: #9 (@types/node 26) closed — runtime is Node 24; add ignore rule for @types/node majors in Task 4. #4-#8 (actions majors, CI green) to merge after #10, via @dependabot rebase.
Task 3: complete (commits f940c8f..e9e4a5c, review clean: 0 Critical/0 Important, 9 Minor). Merged as PR #10 (2ec1002), 8/8 checks green.
  Carried into Task 4: a single registration entry point (src/server/db/register-all.ts, imported by scripts/db-indexes.ts) so `pnpm db:indexes` sees every module's indexes (Task 4 registers dev_outbox); dependabot ignore rule for semver-major @types/node.
  Parked minors (later hardening phase H): index-name drift detection, health failure logging, test helper env restore.
Dependabot #4-#8: "@dependabot rebase" requested after #10; merge when green.
Task 4: dispatching (BASE 2ec1002, branch test/e2e-harness)
Task 4: dispatched (implementer agent a373bb3866ee54a93, sonnet)
Task 4: report DONE_WITH_CONCERNS (458 lines > 400). Ruling: split into PR A feat/provider-container (deps, providers, register-all, dependabot ignore) and PR B test/e2e-harness (Playwright + CI e2e), stacked — each independently reviewable and under the cap — cost: one extra review.
Dependabot: #4 merged (f4c36f8). #5-#8 recomputing mergeability after #4; merge each once MERGEABLE and green (Dependabot auto-rebases on conflict).
Task 4: split delivered — PR A #11 (a7fd808, 398 lines, green), PR B #12 (stacked, 53 lines, green incl. e2e).
  Ruling: the two unit tests dropped to fit A under the cap (setDepsForTests override; production + ALLOW_MOCKS_IN_PROD_BUILD still refuses) are restored in PR B — they guard Review Focus #5, and B's `test:` type covers them — cost: B grows ~30 lines.
  Review of A dispatching (BASE 2ec1002).
Task 4A: complete (commits 2ec1002..a7fd808, review clean: 0 Critical/0 Important, 4 Minor). Merged as PR #11 (c3f7542).
  Carried into B: restore 2 deps tests; make readOutbox's production guard reuse the deps guard (one source of truth) and test it.
  Parked: fake refund ignoring args / idempotency semantics → revisit when the payments phase (O5) replaces the fake with a contract-tested fake.
Dependabot: #5 #7 #8 merged; #6 conflicting → rebase requested.
Ruling: NO force-pushes anywhere (owner's CLAUDE.md: ask before rewriting pushed history; a force-push instruction was blocked). Stacked PRs are redone as fresh branches + new PRs; superseded PRs closed with a pointer — cost: one extra PR number.
Task 4B: implementer resumed to redo B as test/e2e-harness-v2 (new PR), restore the 2 tests, unify the readOutbox guard, close #12.
Task 4B: delivered PR #13 (88 lines, 9/9 green). Review dispatching.
Task 4B: complete (commits c3f7542..0f3c250, review clean: 0 Critical/0 Important, 5 Minor). Merged as PR #13 (31057c3). Trailer check: no Claude attribution on main; 4 "Co-authored-by: dependabot[bot]" lines are GitHub's own squash-merge trailers on Dependabot PRs (allowed).
  Parked minors → Phase H (perf/CI hardening): upload Playwright report on failure; avoid the double build in e2e; e2e exercising getDeps in the prod build; readOutbox NODE_ENV-branch test.
All Phase F tasks complete → final review next.
Final review (opus): ready with fixes — 0 Critical, 5 Important (I1 unit env happy-dom for server tests; I2 db:indexes breaks silently, no spawn test; I3 health 200 "skipped"/bare 500 in prod-like runtime; I4 repo.md merge gate omits e2e + stale names; I5 mock guard only checks deployment flags — preview+prod DB OTP exposure), 10 Minor.
  Ruling: fix I1-I4 now in one fix wave; I5 → document the preview isolation rule now (ALLOW_MOCKS only on Preview, separate preview DB, Deployment Protection on) and ENFORCE in isMockForbidden() + dev routes notFound() in the A-phase dev-outbox PR — cost if wrong: preview misconfig exposes OTPs until A-phase.
  Ruling: accept the safe non-secret defaults in .env.example (MONGODB_URI localhost replset) — no secrets — cost: none.
  Ruling: index changes follow "rename, never change in place" (doc now in docs/decisions/db.md); drift detection lands in phase H before H5.
  Ruling: move earlier to first A-phase e2e PR: Playwright report upload on failure, Mongo in e2e job, require index `name`. Ledger for O5: fake gateway per-process HMAC/in-memory state.
Fix wave dispatching on branch fix/foundation-review-fixes (BASE 31057c3).
Fix wave: DONE PR #14 (4 commits, 218+/23-, 9/9 green). Scoped re-review dispatching.
Fix wave: re-review — I1-I5 resolved (I5 as ruled: docs only), no new Critical/Important. Merged as PR #14.
  Ruling: park re-review minors — pingDb timeout log, src/**/*.test.ts outside server matching no project, link environments.md from README/stack.md, production db:indexes needs devDeps (tsx) — into Phase F5 (first UI PR touches vitest config/README) and H5 deploy runbook — cost: a silently skipped test file until F5.
Phase F COMPLETE.
