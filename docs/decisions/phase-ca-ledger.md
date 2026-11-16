# SDD ledger — plan: /Users/harshi/aarvion-build/docs/superpowers/plans/2026-11-17-phase-ca-server.md

Spec: /Users/harshi/.claude/plans/pasted-content-id-83b6-leave-them-misty-micali.md + docs/requirements.md + PRODUCT.md
Execution: one PR per task from fresh origin/main in worktree /Users/harshi/aarvion-build; task review per PR; controller merges only when lint,typecheck,unit,int,build,e2e,pr-title all pass. NEVER force-push.
Ruling: docs-only PRs may exceed the advisory pr-size check (PR #15 plan doc) — Task 1 also excludes docs/superpowers/** and docs/decisions/** from pr-size counting — cost: none.


## Pre-flight scan

Method: superpowers:subagent-driven-development references/preflight.md. Read-only scan of the plan against `main` 3fa6eb0. Every data expectation in Tasks 1 and 3 (prices, slugs, category sets, search results, family order, 1000x1000 hero) and every date or duration boundary in Tasks 4, 5, 6, 11 and 12 was recomputed against `data/products.json`, the real asset files and the stated rules, and holds.

### A. Pairs of tasks that share a file or an interface

| ID | Task A | Task B | Produces vs. consumes | Finding |
|---|---|---|---|---|
| P1 | T1 | T2 | T1 produces `ProductJson`, `CatalogueJson`, `Product`, `Category`, `CATEGORY_LIST`, `ImageManifest`, `DEFAULT_MRP_PAISE`, `data/product-images.json`; T2 consumes all of them. `toProductDoc` picks the hero by matching `heroImage` (a repo-relative string in `products.json`) against `manifest.photos[].from`. | F1: T1 says only "`from` is the source path". If T1 writes an absolute or normalised path, the hero match in T2 silently fails. |
| P2 | T1 | T3 | `sellingPricePaise`, `Slug`, `Product`, `Category`. | Clean. |
| P3 | T2 | T3 | `PRODUCTS_COLLECTION`, `CATEGORIES_COLLECTION`, `seedCatalogue`, `toProductDoc`; both modify `collections.ts` (T3 appends two indexes). T3's int test also uses `CATEGORY_LIST`, `CatalogueJson`, `ImageManifest`, `DEFAULT_MRP_PAISE`. | F2: T3's Consumes omits four symbols its test setup needs. |
| P4 | T2 | T4, T5, T6, T9 | All append an import to `src/server/db/register-all.ts`; T2's test matches each import by exact relative-path string (existing line: `"../providers/outbox.ts"`). | F3: parallel chains conflict on the same file, and the plan does not say the `.ts` extension is required for the test's string match. |
| P5 | T2 | T4, T5, T6, T9, T3 | T2 makes `name` mandatory in `registerIndexes`. Every later spec in the plan carries an explicit name. Existing `tests/int/db.test.ts` and `providers/outbox.ts` already name theirs. Same `expiresAt_ttl` name on three collections is per-collection, so no clash. | Clean. |
| P6 | T1 | T2 | Both modify `package.json` (`images:sync` vs `seed`). | Clean (different keys, trivially rebased). |
| P7 | T4 | T7 | `hitRateLimit`, `clientIp`, `ipBucket`; key formats and limits are given in T7. | F4: Decisions say the IP is taken from `x-real-ip`; T4 also falls back to `x-forwarded-for`, which a client can spoof when `x-real-ip` is absent. |
| P8 | T4 | T8 | `hitRateLimit` (`allowed` = count <= limit) and `peekRateLimit` (`allowed` = count < limit) used for the 10-per-24 h failure cap. | Clean (the asymmetry is consistent: the 11th verify is blocked by the peek). |
| P9 | T5 | T6 | `Identifier` type only. | Clean. |
| P10 | T5 | T7 | `normalizeIdentifier`, `resendCooldownSec`, `issueOtpChallenge`, `cancelOtpChallenge`, `OTP_TTL_MS`. | Clean. |
| P11 | T7 | T5, T6 | T5 and T6 int tests say "`otp_challenges` is cleared before each case" / need clean collections; `clearCollections` is only added by T7. | F5: T5 and T6 consume a helper that does not exist until T7. |
| P12 | T5 | T8 | `verifyOtpChallenge`, `identifierKey`, `normalizeIdentifier`; reasons `no_active_challenge`, `mismatch`, `consumed_concurrently` all map to 400 `invalid_code`. | Clean. |
| P13 | T6 | T8 | `findOrCreateUserByIdentifier`, `toPublicUser`, `createSession`, `revokeSession`, `SessionKind`. | Clean. |
| P14 | T6 | T9 | `resolveSession`, `revokeSession`, `getUserById`, `toPublicUser`, `Role`, `StaffRole`, `UserDoc`, `SessionDoc`; the 60 s touch and idle math in T9's tests match T6's policy (29 min + 31 min vs 30 min idle). | Clean. |
| P15 | T7 | T8 | Both modify `login.ts` and `tests/helpers/http.ts`; T8 reuses `SendOtpBody` via `.extend` and sends via T7's route in tests. T8's `code` regex rejects a malformed code at `readJson`. | F6: T8 says "400 `invalid_code` (every failure reason)", but a body whose `code` is not 6 digits returns 400 `invalid_request`. |
| P16 | T7 | T9 | `HttpError`, `withErrors`, `jsonResponse`, `assertSameOrigin`. | Clean. |
| P17 | T8 | T9 | `readSessionToken`, `sessionCookieHeader`, `clearSessionCookieHeader`; both modify `login.ts` (T9 adds `appendAudit` after `createSession`). | F7: an `appendAudit` failure after `createSession` returns 500 with a live session the client never receives. |
| P18 | T7, T8, T9 | T10 | Auth routes and test helpers feed `e2e/auth.spec.ts`; T10 `ALLOW_MOCKS_IN_PROD_BUILD` and `OTP_PEPPER` in `webServer.env` match T5/T7 needs. | Clean. |
| P19 | T2 | T10 | Both modify `README.md` (dev line vs e2e note). | Clean (separate sections). |
| P20 | T5 | T10 | Both modify `.env.example` (`OTP_PEPPER` vs a `MONGODB_DB` comment). | Clean. |
| P21 | T11 | T12 | Both live in `src/server/orders/` but share no file and no symbol; neither consumes the other. | Clean. |
| P22 | T1 | ledger | The ledger ruling above adds `docs/superpowers/**` and `docs/decisions/**` to the pr-size excludes "in Task 1". T1's Files list does not mention `scripts/pr-size.ts` or its two tests (`scripts/pr-size.test.ts`, `tests/int/pr-size.test.ts`). | F8: a ruled change has no home in the plan text. |

### B. Internal consistency per task (its tests vs. its code, files created vs. touched later)

| ID | Task | Check | Finding |
|---|---|---|---|
| I1 | T1 | 20 `ProductJson` keys match `products.json`; 11 slugs, prices from the spec map equal MRP - 2000; 4 categories; sacuwin-50 has 3 photos (1000x1000), mucohelp 2; all 11 cutouts exist; `public/` does not exist yet, so everything is created. Files created here (`categories.ts`, schema) are only modified later by T2/T3 as stated. | F10: estimated size at or above the 400-line limit (schema, categories, script, 3 test files, plus F8's pr-size change). |
| I2 | T2 | Index-name tests vs. `registerIndexes` code agree; seed report counts (8/11, 0/8, 0/11) agree with `$setOnInsert` upserts; `slug` in both filter and `$setOnInsert` is legal. The spec says the CLI "exits 1 and names the slug" when the manifest lacks a product. | F13: that CLI behaviour has no test. |
| I3 | T3 | All search, category, family and ordering expectations recomputed on the real data: they hold. T3 only modifies a file T2 created. | Clean. |
| I4 | T4 | Pipeline-upsert code agrees with every test (count 1,2,3,4; boundary at T+600000 with the document still present; 50 racers). `ipBucket` cases agree. | Clean (see F4 for the IP-source inconsistency). |
| I5 | T5 | Issue/verify code agrees with tests (cooldown 1 s at +29.999 s, 5 attempts then locked, boundary at 5:00 with the document present, single use by 5 racers). `env.ts`, `env.test.ts`, `.env.example` are all listed. | F14: the int tests need `OTP_PEPPER` but only the unit tests say to stub it. F10 size risk. |
| I6 | T6 | Session policy arithmetic matches every test (customer 29 d/58 d/30 d; staff 29/58/88 min, 25-min steps to 700 min, 720 min absolute; throttle 60 s). Partial unique indexes fit the upsert. | Clean. |
| I7 | T7 | Send order and tests agree (cooldown before any limiter, 3/10 min, 20/h, /64 bucket). | F9: too large for one PR (3 new source files, route, 3 helpers, 3 test files, about a dozen int cases); the plan already has two commits, so splitting is cheap. F12: "after restoring the mock" is ambiguous, because `resetDepsForTests` also drops the clock override. F20: limiters are hit before delivery, so three failed deliveries lock a user out for 10 min. |
| I8 | T8 | Verify order and tests agree (race gives [200, 400]; 10-fail cap; fixation; staff cookie without Max-Age). | F11: the 10-per-24 h cap is keyed by identifier alone, so anyone who knows a phone or email can lock that user out of login for 24 h with 10 wrong codes. |
| I9 | T9 | Static audit tests agree with the module shape (`appendAudit` the only runtime export; test files excluded from the `audit_logs` grep). Staff idle test matches T6. | F7 (see P17). |
| I10 | T10 | Guard tests, route, Playwright env, CI steps and docs list agree; the `__Host-` fallback instruction is explicit; `actions/upload-artifact@v7` exists (latest tag v7.0.2). | F15: `dev-only.ts` imports `next/navigation` inside `src/server/**`, which the plan calls framework-free. F10 size risk (guard, route, playwright, CI, smoke, docs, e2e, 3 test files). |
| I11 | T11 | Dates in the validity tests are correct (IST clamping, 29 Feb 2028). The 64-pair table agrees with `ORDER_EDGES` and the guards. | F16: `hold` of a paid order returns `refund`, yet `on_hold -> confirmed` is an edge; for a prepaid order that edge is reachable only if the refund is not executed. F10 size risk. |
| I12 | T12 | IST month keys (2611, 2612, 2701), padding and 50-way parallel test agree with the `$inc` upsert code. | Clean. |

### C. Plan "Consumes" vs. what is on `main` (3fa6eb0)

| ID | Item | Plan says | Actual | Finding |
|---|---|---|---|---|
| C1 | Base commit | "Code at `main` 55b306f" | `main` is 3fa6eb0; the diff since 55b306f is CI action bump plus docs only, no `src` change. | F19: stale hash, no code drift. |
| C2 | `src/server/env.ts` | `getEnv`, `EnvError`, `resetEnvForTests`, `APP_URL`, `MONGODB_URI`, `MONGODB_DB` | All present; no `OTP_PEPPER` or `requireEnv` yet (T5 adds both). | Clean. |
| C3 | `src/server/db/*` | `getDb`, `closeMongo`, `ensureIndexes`, `registerIndexes`, `register-all.ts` | All present. `registerIndexes` currently takes `IndexDescription[]`, has no dedupe and a `specName()` fallback (T2 changes this as specified). | Clean. |
| C4 | `providers/*`, `deps.ts` | `getDeps` (sms, email, now), `setDepsForTests`, `resetDepsForTests`, `readOutbox`; `sms.send({to, templateId, vars})`, `email.send({to, subject, html, text})` | All present with these shapes. `writeOutbox` uses `new Date()` (plan acknowledges). The `getDeps()` error text matches `/mock providers are not allowed in production/i`. | Clean. |
| C5 | `guard.ts` and health route | `isMockForbidden()` has the two existing conditions | Matches. The health route also calls `isMockForbidden()` to decide `unconfigured` vs `skipped`. T10 widens the guard to the DB name but lists no health change or test. | F18: side effect on `/api/health` is unmentioned. |
| C6 | `vitest.config.ts`, `package.json` scripts | unit includes `src/server/**` and `scripts/**`; int includes `tests/int/**`; `test:unit`, `test:int`, `pr-size`, `db:up`, `db:indexes`; deps `sharp`, `tsx`, `zod`, `mongodb` | All present. `images:sync` and `seed` are absent as expected (T1/T2 add them). `tests/helpers` holds only `global-setup.ts` and `mongo.ts`. | Clean. |
| C7 | `.github/workflows/*` and `playwright.config.ts` | e2e job gets Mongo and an upload step; required checks `lint, typecheck, unit, int, build, e2e, pr-title` | `ci.yml` e2e has neither today (as the plan assumes); `docker-compose.yml` replica set matches `db:up`. `playwright.config.ts` sets `MONGODB_URI: ""` and the smoke test expects `db: "skipped"` (T10 changes both). `pr-guards.yml` also runs `branch-name` and `pr-size`. | F17: the required-check list omits `branch-name` and `pr-size`. |
| C8 | `data/products.json` | 11 products, 20 keys, `defaultMrpPaise` 40400, `_comment` | Match. Data uses `imageSource: "unbranded"` (Caftop), which the spec's enum lacks but the plan's enum includes. All MRPs are non-null. | Clean. |

### D. Findings and proposed rulings

- F1: Proposed ruling: Specify `manifest.photos[].from` and `cutout.from` as the exact repo-relative string from `products.json` / the `assets/` path, with a test asserting `from` equals the `products.json` entry — T2's hero lookup depends on string equality — cost if wrong: a one-line fix in T1, but a wrong hero image ships silently until the seed test catches it.
- F2: Proposed ruling: Add `CATEGORY_LIST`, `CatalogueJson`, `ImageManifest` and `DEFAULT_MRP_PAISE` to T3's Consumes — the test setup imports them — cost if wrong: none (documentation only).
- F3: Proposed ruling: Each task adds its `register-all.ts` import using the `.ts` extension (`"../security/rate-limit.ts"`) and rebases on `main` just before push — T2's test matches the exact string and every chain touches the file — cost if wrong: a trivial merge conflict or a red `unit` check.
- F4: Proposed ruling: `clientIp` reads `x-real-ip` only and returns `"unknown"` when it is absent (all unknown clients share one bucket); drop the `x-forwarded-for` fallback and its test line — it matches the Decisions text and removes a spoofable path — cost if wrong: local dev without a proxy shares one IP bucket (harmless).
- F5: Proposed ruling: Move the `clearCollections` addition to `tests/helpers/mongo.ts` from T7 into T5 (the first int test that needs it); T2/T3 int tests use inline `deleteMany`; T7 stops modifying `mongo.ts` — T5 and T6 would otherwise have no helper — cost if wrong: T5 and T6 duplicate a few `deleteMany` lines.
- F6: Proposed ruling: Make `VerifyOtpBody.code` `z.string().min(1).max(16)` and let `verifyOtpAndLogin` return `invalid_code` for any non-6-digit string — matches the plan's "every failure is `invalid_code`" and avoids an enumeration difference — cost if wrong: a malformed code returns `invalid_request` instead, which the UI may handle differently.
- F7: Proposed ruling: Accept the ordering (audit after `createSession`) but wrap the call so an audit failure logs `err.name` and does not fail the login — a lost audit row beats a locked-out user, and the session is already stored — cost if wrong: a rare login with no audit row (the reverse choice is a failed login after a stored session).
- F8: Proposed ruling: Add the pr-size exclude change (`scripts/pr-size.ts` plus its two tests) to T1's Files as its own first commit `ci(pr-size): exclude docs/superpowers and docs/decisions from the size count` — the ledger already rules it and the plan has no other home — cost if wrong: T1's PR carries one extra small commit.
- F9: Proposed ruling: Split T7 into two PRs: 7a `http.ts`, `origin.ts`, helpers and their unit tests; 7b `login.ts` `sendOtp`, the send route and `auth-otp-send.test.ts` (T8 then depends on 7b) — keeps each under the ~400-line guide — cost if wrong: one more PR to merge; if kept whole, a pr-size failure and a harder review.
- F10: Proposed ruling: Run `pnpm pr-size origin/main` on T1, T5, T10 and T11 before pushing and split along the existing commit seams if over 400 (T1: schema/pricing vs images; T11: validity vs status) — the plan's own limit — cost if wrong: an advisory pr-size failure and a slower review.
- F11: Proposed ruling: Accept the plan's 10-per-24 h per-identifier cap for this phase and record lockout-by-third-party as a known risk for A5; no code change — the owner-accepted brute-force defence is the plan's explicit decision and the alternative (per identifier plus IP) weakens it — cost if wrong: an attacker who knows a number can block that user's login for 24 h; fix is a one-key change in `OTP_VERIFY_FAILURE_LIMIT`.
- F12: Proposed ruling: Test delivery failure by overriding `sms` with the failing provider and then calling `setDepsForTests({ sms: mockSms })` again, not `resetDepsForTests` — that keeps the fake clock installed — cost if wrong: a flaky or time-skewed test.
- F13: Proposed ruling: Add one int test that runs `pnpm seed` against a manifest missing a slug (copy `data/` to a temp dir via an env override) and expects exit 1 naming the slug, or drop the exit-1 requirement from the plan — spec behaviour should not be untested — cost if wrong: an unverified error path in a dev script.
- F14: Proposed ruling: In T5 and every later int file, call `vi.stubEnv("OTP_PEPPER", "x".repeat(64))` plus `resetEnvForTests()` in `beforeAll` — `hashOtp` throws without it — cost if wrong: red int tests on first run, easily fixed.
- F15: Proposed ruling: Accept `next/navigation` in `src/server/dev-only.ts` as the one framework import and note it in the file header — Next's 404 digest is the only way to get a 404 from a route handler, and the int test already asserts it — cost if wrong: none at runtime; a lint or unit import problem would show in T10's first run.
- F16: Proposed ruling: Keep the `hold -> refund` effect and `on_hold -> confirmed` edge as written (the spec says Rx rejected leads to on hold and refund), and document that a prepaid order can leave `on_hold` only through `cancel` unless the caller defers the refund — O2 will decide when it executes effects — cost if wrong: O2 must make the refund effect deferrable, a small change.
- F17: Proposed ruling: Add `branch-name` to the by-name check list and state that `pr-size` is advisory per the ledger ruling — they are real checks in `pr-guards.yml` — cost if wrong: merging with an unreviewed failing check.
- F18: Proposed ruling: Accept the side effect (DB name `aarvion_prod` with no `MONGODB_URI` now reports `unconfigured` on `/api/health`) and add a one-line health int-test case in T10 — it is the safer failure — cost if wrong: a misleading health message in a misconfigured environment.
- F19: Proposed ruling: Branch every task from the current `origin/main` and ignore the stale hash — only docs and a CI bump differ — cost if wrong: none.
- F20: Proposed ruling: Keep the plan's order (limiters before delivery) — it stops SMS pumping — and note that provider outages can use up the 3-per-10-minute budget — cost if wrong: during an outage users are blocked for up to 10 min, versus unbounded SMS spend.
Ruling: accept pre-flight proposed rulings F1-F20 as written in section D — they tighten tests, fix ordering hazards and split T7 (7a/7b) — cost if wrong: minor rework. Required-checks gate now: lint,typecheck,unit,int,build,e2e,pr-title,branch-name (pr-size advisory).
Task 1: dispatching (BASE 3fa6eb0)
Task 1: dispatched (implementer aecaec634b59f9c0b, sonnet)
Task 1: report DONE_WITH_CONCERNS (469 lines). Ruling: split along commit seams — 1a feat/catalogue-schema (900e1e8+aafe1c6 ≈305) now, 1b feat/catalogue-images (0318057) after 1a merges — cost: one more review.
Ruling: STOP deleting remote branches on merge (owner's CLAUDE.md: ask before deleting remote branches). Merge with `gh pr merge <n> --squash` only. Earlier merges (#1-#15) used --delete-branch; disclosed to the owner; branches are restorable from each PR page — cost if wrong: stale branches accumulate.
Task 1a: DONE PR #16 (305 lines, green). Review dispatching.
Task 1a: complete (3fa6eb0..a8107b9, review clean: 0C/0I/5 Minor). Merged PR #16 via .tools/merge-gate.sh (no branch deletion).
  Parked minors → Task 2 (seed touches schema): assert zod issue paths in rejection tests; add H1 rx case + mrpPaise 2099 + mrpSource "admin" cases; resolve test data paths via import.meta/repo root; tie mrpPaise null ⇄ mrpSource "default".
Task 1b: resuming implementer to cherry-pick 0318057 onto feat/catalogue-images.
Task 1b: DONE PR #17 (164 lines, green). Review dispatching.
Task 1b: complete (8d7c94c..4d3a4bd, review clean: 0C/0I/4 Minor). Merged PR #17. Task 1 COMPLETE.
  Parked minors → Phase H: stale public/products file check + byte/hash verification; null-cutout branch test; validate manifest with ProductImage before write; hash8 collision guard.
Task 2: dispatching (BASE a2913de)
Task 2: dispatched (implementer aadb17f048791aafa, sonnet)
Task 2: report DONE_WITH_CONCERNS (451 lines). Ruling: split — 2a (7008964+1eb0b6a) now, 2b (cef38cf) after 2a merges. Ruling (standing, in dispatch-common.md): implementers split oversize work along commit seams themselves into sequential -a/-b PRs — cost: none.
Task 2a: DONE PR #18 (153 lines, green). Review dispatching.
Task 2a: complete (a2913de..356b4c7, review clean: 0C/0I/5 Minor). Merged PR #18.
  Parked minors → 2b: assert `unrecognized_keys` code for the extra-key case; positive mrpSource "admin" Product test; register-all test should parse imports, not substring-match.
Task 2b: resuming implementer (cherry-pick cef38cf onto feat/catalogue-seed-b) + the 2a minors above.
Task 2b: DONE PR #19 (325 lines, green). Review dispatching.
Task 2b: review — spec ✅, Needs fixes: 1 Important (seed keeps stale heroImage field; non-strict schema hides it), 6 Minor.
Task 2b: minor (deferred): see task-2b-review.md Minor list (6) — for the Phase CA final review to triage.
Task 2b: fix round 1/5 dispatched to the original implementer (FIX_BASE 04b218b).
Task 2b: fix round 1/5 (1 addressed, 0 open — heroImage leak; commits 04b218b..e59f490). Re-review: ADDRESSED, no new breakage (minor: const between imports).
Task 2b: complete (969c9cb..e59f490, 1 Important fixed). Merged PR #19. Task 2 COMPLETE.
Task 3: dispatching (BASE 849d995)
Task 3: dispatched (implementer a0a81cc12589a7193, sonnet)
Task 3: DONE PR #20 (335 lines, green). Ruling: getProductBySlug/getFamily require a live category (consistent with the public-catalogue ruling) — cost: none. Review dispatching.
Task 3: complete (849d995..cbfc522, review clean: 0C/0I/5 Minor). Merged PR #20.
Task 3: minor (deferred): assert slugs in the not-live test; test getFamily live/inactive gating; variantNumber redundant; listVisibleCategories sort tiebreak; use parsed slug after safeParse — to C4 (product page uses getFamily) and the final review.
Task 4: dispatching (BASE 003ecc5)
Task 4: dispatched (implementer aa7b30b224d11cd17, sonnet)
Task 4: DONE PR #21 (275 lines, green). Review dispatching.
Task 4: complete (003ecc5..30930ff, review clean: 0C/0I/4 Minor; concurrency verified exact-N). Merged PR #21.
Task 4: minor (deferred → Task 7 send route uses per-IP): unmap hex/long IPv4-mapped IPv6 forms so they don't share one bucket; deterministic E11000 retry test; non-integer retryAfterSec ceil test.
Task 5: dispatching (BASE 69a5a67)
Task 5: dispatched (implementer a06bc80f18758ffd0, sonnet)
Task 5: split per standing ruling — 5a PR #22 (124 lines: identifier, OTP_PEPPER/requireEnv, clearCollections); 5b local 6b2abe0 (otp.ts + tests) pending. Review of 5a dispatching.
Task 5a: complete (69a5a67..327e9b5, review clean: 0C/0I/4 Minor). Merged PR #22.
Task 5a: minor (deferred → 5b): 254-char email accept test; 31-char pepper getEnv throw test; (optional) email local-part limit.
Task 5b: resuming implementer (cherry-pick 6b2abe0 → feat/otp-challenges-b) + 5a minors.
Task 5b: DONE PR #23 (332 lines, green). Review dispatching (security-sensitive → opus).
Task 5b: complete (c4ec828..22f4104, security review clean (opus): 0C/0I/8 Minor; all OTP properties hold in code). Merged PR #23. Task 5 COMPLETE.
Ruling (carry → Task 6): start the int-test memory replset with TTL monitor disabled (setParameter ttlMonitorEnabled=false) so fixed past test clocks can't race MongoDB's TTL sweep — cost: TTL behaviour only asserted by index existence; also pin the flaky asserts in tests/int/otp.test.ts (:56 JSON substring, :68 superseded reason) and add a parallel-wrong-verifies-stop-at-5 test.
Carry → Tasks 7/8: callers pass only normalizeIdentifier output; send route never logs/returns the code; verify collapses all failures to invalid_code (F6); brute-force limit = Task 4 send limits + F11 cap (otp.ts resets attempts per re-issue).
Task 6: dispatching (BASE e0b486f)
Task 6: dispatched (implementer a0fb302ebd2e34caa, sonnet)
Task 6: DONE_WITH_CONCERNS — split: 6a PR #25 (test isolation: TTL monitor off, flaky OTP pins, 31 lines); 6b local 7b26353 (users + sessions, 439 lines). #24 opened then closed as superseded (branch kept).
  Ruling: 6b may land at 439 lines (pr-size advisory; users+sessions+tests are one reviewable unit) — cost: a slightly larger review.
  Ruling: requireRole/guards stay in Task 9 per plan; setUserRole revokes sessions; extra sessions.userId_1 index accepted (needed for revocation) — cost: none.
Task 6a: complete (e0b486f..88d3558, review clean: 0C/0I/3 Minor). Merged PR #25. Task 6b: resuming implementer (cherry-pick 7b26353 → feat/auth-sessions-b).
Task 6b: DONE PR #26 (440 lines; pr-size advisory fail per ruling). Review dispatching (opus, security).
Task 6b: complete (9cafc84..d69007b, security review clean (opus): 0C/0I/8 Minor). Merged PR #26 (5a3935c). Task 6 COMPLETE. (merge-gate.sh fixed: `gh pr checks` non-zero on advisory failures no longer aborts the gate.)
Carry → Task 8 (verify uses findOrCreate): sessionKindForRole must fail CLOSED (only explicit staff roles → staff); find-or-create filter must map channel via a fixed {sms:"phone",email:"email"} table, never the caller's string as a field name.
Carry → Task 9 (guards): getAuth treats getUserById null as unauthenticated; requireRole reads role fresh from DB + checks session.kind; stale-privilege test sets role via raw updateOne (setUserRole revokes → 401); a session revoked between read and touch must not be returned valid.
Task 7: dispatching as 7a/7b per F9 (BASE 5a3935c)
Task 7: dispatched (implementer a303281a590bde566, sonnet; 7a first)
Task 7a: DONE PR #27 (279 lines, green). Review dispatching.
Task 7: minor (deferred): one local int-file failure on first run, clean on rerun — possible memory-replset startup flake; investigate in the phase final review / H.
Task 7a: complete (5a3935c..ac067ea, review clean: 0C/0I/5 Minor). Merged PR #27.
Ruling (carry → 7b): readJson caps the body (16 KB, 413 payload_too_large) and matches Content-Type exactly as application/json with optional parameters (not startsWith); add origin negative tests (scheme, port, lookalike prefix/suffix, trailing slash, APP_URL with path) — cost: a few lines.
Carry → Task 10: withErrors must rethrow Next notFound()/redirect() (or not wrap dev-only routes).
Task 7b: split — 7b-1 PR #28 (129 lines: body cap, exact Content-Type, origin negatives, IPv4-mapped unmapping); 7b-2 local 8663262 (send route, ~379 lines) pending. Review of 7b-1 dispatching.
Task 7b-1: complete (d1bec73..c176d54, review clean: 0C/0I/5 Minor; body cap stream-counted, Content-Type exact, IPv4-mapped unmapping verified). Merged PR #28.
Task 7b-1: minor (deferred → 7b-2): lying small Content-Length + over-cap body test; exact 16384/16385 boundary test.
Task 7b-2: DONE PR #29 (396 lines, green). Review dispatching (opus, security).
Task 7b-2: complete (f122978..c1e365e, security review clean (opus): 0C/0I/11 Minor). Merged PR #29. Task 7 COMPLETE.
Ruling (carry → Task 8): add the two ordering assertions from task-7b2-review.md — cooldown spends neither the identifier NOR the IP counter; per-IP limit is evaluated before per-identifier (a blocked IP cannot spend a victim's 3/10min budget) — cost: two tests.
Carry → N phase (real providers): MSG91/Resend adapters must keep the code out of logs.
Task 8: dispatching (BASE 5f15872)
Task 8: dispatched (implementer af210c6f01918e408, sonnet)
Task 8: DONE_WITH_CONCERNS — split: 8a PR #30 (cookie helpers, fail-closed kind + fixed field table, send ordering pins; 150 lines); 8b local 6b0bf8f (verify route, ~388 lines with 3 int tests trimmed).
  Ruling: tests are never dropped to fit the advisory size cap — 8b restores the 3 trimmed int tests even if it lands slightly over 400 (same as 6b) — cost: a slightly larger review.
  Ruling: VerifyOtpBody.code = z.string().max(16) accepted (F6: every bad code → 400 invalid_code). Channel table {phone,email} accepted. Failure-cap peek-then-hit may overshoot slightly under concurrency; per-challenge 5-attempt lock is atomic — accepted, revisit with F11 in A5.
Task 8a: complete (5f15872..796f97e, review clean: 0C/0I/7 Minor). Merged PR #30.
Carry → 8b: one-line doc note — __Host- cookie needs Secure: works on http://localhost in Chrome/Firefox, not Safari or LAN/*.test hosts (use https dev or localhost); derive 30-day Max-Age from SESSION_POLICY; break the users↔sessions runtime import cycle (move STAFF_ROLES to a leaf module).
Task 8b: DONE PR #31 (427 lines, advisory pr-size fail per ruling). Review dispatching (opus, security).
Task 8b: complete (6205cc9..a76e27f, security review clean (opus): 0C/0I/9 Minor). Merged PR #31. Task 8 COMPLETE.
Carry → Task 9: use session.kind (not recomputed); sliding customer cookie re-issue in /api/auth/me; break cookie.ts → sessions.ts runtime import (pass kind/policy in); restore spies in finally.
Carry → H2/D: no user status (disabled/deleted) exists — a hard-deleted user re-registers on next verify; admin "block user" needs a status field honoured by verify + getAuth. Clear the F11 failure counter on successful login (revisit with A5 lockout UX).
Task 9: dispatching (BASE cfcbaf4)
Task 9: dispatched (implementer a32af70dc9dbc6e27, sonnet)
Task 9: DONE_WITH_CONCERNS PR #32 (509 lines; local pre-commit count was wrong).
  Ruling: accept 509 lines without splitting — two cohesive commits (audit writer, guards+routes), mostly tests, reviewed by opus — cost: a heavier review.
  Ruling: cookie.ts keeps a local Max-Age constant pinned to SESSION_POLICY by test (cycle broken); resolveSession re-reads on touch-miss so a revoked session returns null; logout revokes any well-formed presented token even if user lookup fails — all accepted.
Task 9: complete (cfcbaf4..e63cc79, security review clean (opus): 0C/0I/9 Minor). PR body size line corrected by controller. Merged PR #32. Task 9 COMPLETE.
Carry → Task 10: logout revokes BEFORE writing the audit row; add a Promise.all concurrent resolveSession test (re-read branch); tighten audit assertions (actor.userId).
Carry → first customer route (K1 cart API): requireUser for customer sessions must re-issue the sliding cookie whenever it slides the session (not only /me).
Task 10: dispatching (BASE f0a55a9)
Task 10: dispatched (implementer a8fb038485ce49822, sonnet)
Task 10: DONE PR #33 (272 lines, green). Review dispatching (opus).
Task 10: complete (f0a55a9..9900e97, review clean (opus): 0C/0I/8 Minor). Merged PR #33. Task 10 COMPLETE — closes Phase F I5 (preview isolation) subject to M1.
Ruling (M1): production must run with MONGODB_DB=aarvion_prod; enforce fail-closed in H4 production gates (startup assertion: VERCEL_ENV=production ⇒ MONGODB_DB=aarvion_prod) and record in the deploy runbook — cost if wrong: until H4, a prod deploy left on the default DB name with a mocks-enabled preview sharing it would bypass the guard (no prod deploy exists yet).
Task 11: dispatching (BASE 984255f)
Task 11: dispatched (implementer a5a4059664ed00279, sonnet)
Task 11: split — 11a PR #35 (Rx validity, IST, 148 lines); 11b local/pushed-stacked 805b39b (state machine, 376 lines). #34 closed as superseded (branch kept).
  Ruling: guard precedence on ship = awb_required → rx_not_valid → payment_required — accepted (UI shows each blocked reason) — cost: none.
  Ruling: 11b opens on a FRESH branch name (feat/order-state-machine-c) cut from origin/main after 11a merges, since feat/order-state-machine-b is already pushed stacked on A — no force-push.
Task 11a: complete (984255f..79d4088, review clean (opus): 0C/0I/4 Minor; 90,529 IST date checks × 6 server TZs, 0 failures). Merged PR #35.
Carry → 11b: a test that runs validity under a non-UTC TZ (e.g. spawn vitest/child with TZ=America/Los_Angeles, or a pinned helper test); named tests for 31 Mar→30 Sep, 29 Feb+6, valid-until ≤ cap, invalid dates; state machine judges Rx validity on order.createdAt.
Carry → R phase (Rx review save): store rxDate as IST midnight via an exported helper (istMidnight("YYYY-MM-DD")); pharmacist valid-until becomes next IST midnight.
Task 11b: PR #36 (state machine, 376 lines, green); carries commit 3633544 on feat/order-state-machine-d (stacked, not opened) → to land as feat/order-state-machine-e after #36.
Ruling (SUPERSEDES plan-writer #16 "validity judged on order creation date"): Rx must be valid at order creation AND at ctx.at for each gated transition (confirm, ship) — dispensing happens at dispatch; an expired Rx cannot authorize it (compliance-first) — cost if wrong: some orders need a fresh Rx if review/dispatch is slow. Implementer amending #36 with a new commit; carry (c) test inverted accordingly.
Task 11b: #36 amended (5b39915 + 3 test-compaction commits; 398 lines, green). Carries + 5 moved tests prepared on local feat/order-state-machine-e (f6668b2, 181 lines) — branch -d superseded. Review dispatching (opus).
Task 11: minor (deferred): MongoMemoryServer "port already in use" flake seen again on a local int run (rerun clean) — investigate in phase final review (port allocation / parallel files).
Task 11b: review (opus) — spec ✅; quality needs fixes: 0C / 2I (both ruling/plan-mandated) / 5 Minor. Review: task-11b-review.md.
Ruling (SUPERSEDES "valid at createdAt AND ctx.at"; I1+I2): confirm, pack and ship judge the Rx CURRENTLY attached to the order at ctx.at only; order placement (O2) judges the Rx at createdAt. Edges amended: confirmed → on_hold and packed → on_hold (staff hold with a reason, e.g. Rx lapsed); the customer cancel window ("until packed") is enforced by actor in the O-phase API, not by the edge table — why: dispensing law cares about validity when the pharmacist confirms and the pack leaves; the createdAt half made a replacement Rx unusable (I2) and left a dead `packed` state with no refund path (I1) — cost if wrong: an order placed on a valid Rx ships under a later, pharmacist-approved replacement Rx (which is what the pharmacist signed off anyway); two extra edges in the table.
Ruling: merge #36 as-is (green, pure, no consumer of transition() on main yet); the I1/I2 ruling fix + M1–M5 ride in the follow-up PR feat/order-state-machine-e (with the 11a carries + moved tests), reviewed as Task 11b fix round 1. Task 11 stays OPEN until that review is clean — cost if wrong: main briefly holds the superseded guard (nothing calls it).
Task 11b: minor → fixed in round 1 (not deferred): M1 no-refund + reason-key assertions in the 64-pair loop; M2 store trimmed reason; M3 fail closed on unknown status + Object.freeze edges; M4 structuredClone immutability check; M5 validity.ts:43 contract comment.
Task 11b: fix round 1 dispatched (resume a5a4059664ed00279) → PR feat/order-state-machine-e2 (carries + ruling fix + M1–M5). #36 merged.
Task 12: dispatching (BASE 18ecf42) in separate worktree /Users/harshi/aarvion-t12 — Ruling: run Task 12 concurrently with the 11b re-review because it touches only new files (order-number.ts + tests) in its own worktree — cost if wrong: a rebase-free conflict at most in nothing shared.
Task 12: dispatched (implementer ae2c0e4b086bf6c24, sonnet, worktree aarvion-t12). Task 11b: fix round 1 → PR #38 (324 lines, green, head c788151); scoped re-review dispatched (opus ab30a369f8be67bba).
Task 12: DONE PR #39 (green; 8027e90). Review dispatching (sonnet→opus? sonnet: small mechanical diff + race).
Task 12: review (sonnet) spec ✅, 0C/1I/3M — I1 no deterministic E11000 retry test. Fix round 1 dispatched (resume ae2c0e4b086bf6c24).
Task 12: minor (deferred): M1 TZ test relies on Node re-reading process.env.TZ at runtime (comment it); M2 invalid Date → generic RangeError from formatToParts (untested); M3 CounterDoc type redeclared in the int test.
Task 11b: fix round 1/5 (7 addressed, 0 open — I1 dead packed state, I2 replacement Rx, M1–M5; commits 18ecf42..c788151). Re-review (opus): mergeable; exhaustive scratch probe found no dead state / no unsafe ship. Merged PR #38 with a corrected squash body (8512b3b's message had the old rule).
Task 11: complete (984255f..c788151 via #35, #36, #38; review clean after round 1).
Task 11: minor (deferred): "omits reason" test passes even if confirm failed; 8512b3b reformatted otp.ts:118-121 (unmentioned); test name status.test.ts:98 still says "on the order date"; TZ test builds "file://"+path import (use pathToFileURL).
Carry → O-phase (O2/D): `hold` is STAFF-ONLY (else a customer can hold a packed order then cancel, bypassing "cancel until packed"); O2 passes server time as ctx.at and owns the Rx-at-createdAt check at placement; refunds idempotent and refund_pending set in the SAME write as the hold.
Carry → phase-end rulings persistence: docs/decisions/rulings.md:69 still has the old Rx wording — replace with the ctx.at-only ruling.
Task 12: fix round 1 → c14203a (retry tests a/b/c + minors 1,2); scoped re-review dispatched (sonnet ad6ab4d6571c246e6).
Task 12: fix round 1/5 (1 addressed, 0 open; 8027e90..c14203a). Re-review (sonnet): mergeable. Merged PR #39.
Task 12: complete (18ecf42..c14203a, review clean after round 1). ALL 12 TASKS COMPLETE.
Final review: dispatching (opus) over 3fa6eb0..060deb1, excluding design/**, DESIGN.md, .impeccable/**, docs/**, lockfile, render/flyer scripts (PR #37 design import is not Phase CA code).
Final review + UI plan writer hit the account rate limit; both resumed from saved state after reset.
Final review (opus): READY WITH FIXES — 0C / 3I / 15M. I1 verify lockout griefing (no per-IP verify limit; no-challenge verifies count toward 24h lockout); I2 int port flake root cause (getport per-process cache + parallel workers); I3 rulings.md:69 stale Rx rule. FIX NOW: flake fix, rulings.md. Rest deferred to named phases (table in final-review.md).
Ruling (I1): fix now in the wave (not deferred to A5) — only code MISMATCHES on an existing live challenge count toward the 24h per-identifier lockout; add a per-IP verify limit of 60/h (Indian mobile CGNAT shares IPs, so looser than send's 20/h); a successful verify clears that identifier's failed-verify counter — why: ten unauthenticated POSTs per phone must not lock a customer out for a day; F11 accepted only targeted lockout of one known user — cost if wrong: a CGNAT block hits the 60/h verify cap (they wait an hour).
Final review: fix wave dispatching (ONE fixer, all findings).
Final review: fix wave dispatched (opus ace7566f1331d43fe, branch fix/ca-final-review, FIX_BASE 060deb1): A verify lockout, B int port flake, C rulings.md.
Final fix wave: DONE_WITH_CONCERNS PR #40 (314 lines, green; 6a842e8, 4db86c1, df032da; int 5/5 clean runs).
  Ruling: a verify against an attempts-exhausted challenge does not count toward lockout (no code compared) — locking needs ≥2 real OTP sends, which are themselves rate-limited — cost: an attacker needs 2 SMS per victim (still capped 3/10min/identifier).
  Ruling: consumed_concurrently not counted (only mismatches) — cost: none material.
  Ruling: per-IP verify limit runs after pure identifier normalisation (malformed → 400 without spending IP budget) but before lockout and any DB read — cost: unlimited cheap 400s, no DB work.
  Ruling: two concurrent local int runs share the deterministic port block and fall back via retry — cost: slower local double-runs only.
Final fix wave: scoped re-review dispatching (opus) over 060deb1..df032da.
Final fix wave: re-review (opus) — I1, I2, I3 ADDRESSED; 0 new C/I; 4 Minor. Merged PR #40. PHASE CA COMPLETE.
  Ruling (re-review M1): the timing difference between a mismatch (extra counter write) and a dead/no challenge is accepted — send's 30 s cooldown already reveals a live challenge — cost: a timing oracle for challenge existence, low value.
Carry → A5: wrap resetRateLimit after a successful verify in try/catch (as the audit write is), so a limiter failure can't turn a login into a 500.
