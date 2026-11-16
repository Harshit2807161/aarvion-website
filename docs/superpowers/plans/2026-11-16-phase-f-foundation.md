# Phase F (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js 16 + TypeScript repo that builds, lints, type-checks and runs unit, integration and end-to-end tests in CI. It has a cached MongoDB client, an index registry and mock providers, so every later feature PR has somewhere to land.

**Architecture:**
- Next.js App Router at the repo root (`/Users/harshi/aarvion`, GitHub `Harshit2807161/aarvion-website`).
- All business logic lives in framework-free `src/server/**`; route handlers stay thin.
- External services (SMS, email, payments, files) sit behind interfaces in a `deps` container, with mocks for dev and test that production refuses to start with.

**Tech Stack:**
- Next.js 16 (App Router), React 19, TypeScript 6.0.x strict, pnpm 12, Node 24 (`engines`, `.nvmrc`).
- `mongodb` driver 7 + zod 4.
- ESLint (flat config, `eslint-config-next`, typescript-eslint, jsx-a11y) + Prettier.
- Testing: Vitest (projects `unit` happy-dom, `int` node), React Testing Library, `mongodb-memory-server` (`MongoMemoryReplSet`), Playwright.
- GitHub Actions.

**Spec:** `/Users/harshi/.claude/plans/pasted-content-id-83b6-leave-them-misty-micali.md` (Stage 4/5) plus the PR table in `docs/progress.md`. Stack sub-choices were decided by the delegate on 2026-11-16 because the owner was away (see `docs/decisions/stack.md`, written in Task 1).

## Global Constraints
- Branch `type/short-desc` off up-to-date `main`; Conventional Commit PR titles; squash-merge.
- **No `Co-Authored-By` trailer, no "Generated with" lines.**
- PRs stay under ~400 changed lines, excluding lockfile, `data/**`, binary assets and generated shadcn files.
- Every PR adds or updates unit and/or integration tests and passes `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build` locally before push. Show the output in the PR body.
- Never import-time throw on missing env: env is read lazily via `getEnv()`.
- No secrets in tracked files. `.env.example` lists names only.
- Mongo money values are integer paise.
- Mock providers are forbidden when `VERCEL_ENV === "production"` or `NODE_ENV === "production" && !ALLOW_MOCKS_IN_PROD_BUILD`. The e2e production build sets the latter explicitly.
- The agent merges a PR itself once all required checks are green (`gh pr merge --squash --delete-branch`). The owner authorised this.

## Review Focus
1. **Missing or partial env vars:** importing any module must not throw; only the call that needs a value fails, with a message naming the missing key. Test in Task 1.
2. **Mongo unreachable at request time:** `/api/health` must return 503 with `db: "down"` and must not hang longer than about 3 s (`serverSelectionTimeoutMS`). Test in Task 3.
3. **A first DB connect that fails:** the cached client promise must reset, so the next call retries instead of returning the rejected promise forever. Test in Task 3.
4. **Running `pnpm db:indexes` twice, or concurrently:** it must be idempotent, with no duplicate-index errors. Test in Task 3.
5. **Mock providers reaching production:** `getDeps()` must throw at the first call in production mode. Test in Task 4.

---

### Task 1: Scaffold the Next.js app (PR `chore/scaffold-next-app`)

**Files:**
- Create:
  - `package.json`, `pnpm-lock.yaml`, `.nvmrc` (24), `tsconfig.json` (strict, `noUncheckedIndexedAccess`, path alias `@/*` → `src/*`);
  - `next.config.ts`, `eslint.config.mjs`, `.prettierrc`, `.editorconfig`, `vitest.config.ts` (projects `unit`: `src/**/*.test.ts(x)` happy-dom; `int`: `tests/int/**/*.test.ts` node);
  - `src/app/layout.tsx`, `src/app/page.tsx` (placeholder "Aarvion: coming soon"), `src/app/api/health/route.ts`;
  - `src/server/env.ts`, `.env.example`, `docs/decisions/stack.md`.
- Test: `src/server/env.test.ts`, `tests/int/health.test.ts`.

**Interfaces:**
- Produces:
  - `getEnv(): Env`. Lazily zod-parses `process.env` once and caches the result. Throws `EnvError` whose `message` lists each missing or invalid key.
  - `resetEnvForTests(): void`.
  - `type Env = { NODE_ENV; MONGODB_URI?: string; MONGODB_DB: string (default "aarvion"); APP_URL?: string; VERCEL_ENV?: "production"|"preview"|"development"; ALLOW_MOCKS_IN_PROD_BUILD?: "1" }`.
  - `GET /api/health` → `200 {status:"ok", version: string, db:"skipped"}` (db is wired in Task 3).

- [ ] **Step 1:** `pnpm create next-app@16` with TS, App Router, ESLint, `src/`, no Tailwind yet (Tailwind arrives with the tokens PR F5). Pin TS to 6.0.x. Add `engines.node ">=24"` and `packageManager pnpm@12.x`.
- [ ] **Step 2:** Write the failing tests. In `src/server/env.test.ts`:
  - `it("does not throw on import when MONGODB_URI is missing")`: dynamic import succeeds.
  - `it("getEnv() returns defaults")`: `MONGODB_DB === "aarvion"`.
  - `it("rejects an invalid VERCEL_ENV with the key named")`: `expect(() => getEnv()).toThrow(/VERCEL_ENV/)`.

  In `tests/int/health.test.ts`, call the `GET` export directly: status 200, `json.status === "ok"`.
- [ ] **Step 3:** Run `pnpm test:unit && pnpm test:int`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement `src/server/env.ts` and the health route. Write `docs/decisions/stack.md`, recording each Stage 4 choice and that it was delegated:
  - native mongodb + zod;
  - MSG91 (SMS) + Resend (email) behind interfaces;
  - Vercel Blob private (Rx files);
  - DB-backed sessions;
  - Mongo TTL rate limiter;
  - Tailwind 4 + shadcn/ui;
  - Vitest/RTL/mongodb-memory-server/MSW/Playwright;
  - Node 24, pnpm, TS 6.0.
- [ ] **Step 5:** Run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build`. Expected: all pass.
- [ ] **Step 6:** Commit `chore: scaffold Next.js 16 app with env loader and health route`. Push, open the PR, merge when green (CI exists from Task 2; for this first PR, local checks are the gate).

### Task 2: CI and repository guards (PR `ci/pipeline-and-guards`)

**Files:**
- Create:
  - `.github/workflows/ci.yml`: jobs `lint`, `typecheck`, `unit`, `int`, `build` on Node 24 + pnpm cache; `int` caches the mongod binary dir (`~/.cache/mongodb-binaries`).
  - `.github/workflows/pr-guards.yml`: semantic PR title (`amannn/action-semantic-pull-request@v5`), branch-name regex, PR size.
  - `scripts/pr-size.ts`, `.github/pull_request_template.md` (What / Why / How tested / Risks & rollback), `.github/dependabot.yml` (npm weekly, actions monthly).
- Test: `scripts/pr-size.test.ts` (unit), `tests/int/pr-size.test.ts` (temp git repo).

**Interfaces:**
- Produces:
  - `countChangedLines(diffNumstat: string, exclude: string[]): number`. Parses `git diff --numstat` lines and skips paths matching the globs.
  - CLI `pnpm pr-size <base>`: exits 1 when the count is over 400.
- Branch regex: `^(feat|fix|chore|ci|test|docs|refactor|perf|build)/[a-z0-9-]+$` (dependabot branches allowed).

- [ ] **Step 1:** Write the failing tests:
  - `countChangedLines` ignores `pnpm-lock.yaml`, `data/**`, `**/*.webp|png|svg` and files whose first line contains `@generated shadcn`;
  - the binary `-\t-` rows count 0;
  - a 401-line fixture → the CLI exits 1.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the script and the workflows.
- [ ] **Step 4:** Run the tests. Expected: PASS. Push, and confirm the checks appear on the PR.
- [ ] **Step 5:** After merge, set branch protection on `main` with `gh api -X PUT repos/Harshit2807161/aarvion-website/branches/main/protection`: required checks `lint`, `typecheck`, `unit`, `int`, `build`, `pr-title`; strict (up to date); linear history; 0 approvals; enforce admins false. Record the command in `docs/decisions/repo.md`.

### Task 3: Mongo client, index registry, local replica set (PR `feat/db-client-and-indexes`)

**Files:**
- Create:
  - `src/server/db/client.ts`, `src/server/db/indexes.ts`, `scripts/db-indexes.ts`;
  - `docker-compose.yml` (mongo:8, `--replSet rs0`, healthcheck that runs `rs.initiate` once);
  - `tests/helpers/mongo.ts`.
- Modify: `src/app/api/health/route.ts` (db ping), `package.json` scripts `db:up`, `db:down`, `db:indexes`.
- Test: `src/server/db/client.test.ts` (unit, mocked driver), `tests/int/db.test.ts`, `tests/int/health-db.test.ts`.

**Interfaces:**
- Consumes: `getEnv()`.
- Produces:
  - `getMongoClient(): Promise<MongoClient>`: cached on `globalThis.__aarvionMongo`. Options: `serverSelectionTimeoutMS: 3000`, `maxPoolSize: 10`, `maxIdleTimeMS: 5000`. It calls `attachDatabasePool` from `@vercel/functions` when available.
  - `getDb(): Promise<Db>`.
  - `closeMongo(): Promise<void>`.
  - `registerIndexes(collection: string, specs: IndexDescription[]): void`.
  - `ensureIndexes(db: Db): Promise<{collection: string; created: string[]}[]>`.
  - `tests/helpers/mongo.ts`: `startMemoryReplSet(): Promise<string /*uri*/>`, `stopMemoryReplSet(): Promise<void>`.

- [ ] **Step 1:** Write the failing tests:
  - unit: `getMongoClient` returns the same promise twice; after a rejected connect, the next call creates a new client;
  - int (memory replset): `ensureIndexes` run twice → the second run creates nothing and does not throw;
  - int: two concurrent `ensureIndexes` calls both resolve;
  - int: health with a reachable DB → 200 `db:"ok"`;
  - int: health with `MONGODB_URI=mongodb://127.0.0.1:1` → 503 `db:"down"` within 4 s.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Health returns `db:"skipped"` when `MONGODB_URI` is unset.
- [ ] **Step 4:** Run all tests, plus `pnpm db:up && pnpm db:indexes` locally (colima is running). Expected: PASS, and the indexes command prints its per-collection results.
- [ ] **Step 5:** Commit `feat(db): add cached Mongo client, index registry and local replica set`. Then PR and merge when green.

### Task 4: E2E harness and provider container (PR `test/e2e-harness`)

**Files:**
- Create:
  - `src/server/providers/types.ts`;
  - `src/server/providers/mock-sms.ts`, `mock-email.ts` (write to the `dev_outbox` collection with a 1-day TTL index registered via `registerIndexes`), `fake-payments.ts`, `memory-files.ts`;
  - `src/server/deps.ts`;
  - `playwright.config.ts`, `e2e/smoke.spec.ts`;
  - CI job `e2e` in `ci.yml` (installs Chromium, starts a memory or service Mongo, `pnpm build && pnpm start`).
- Test: `src/server/deps.test.ts`, `tests/int/mock-outbox.test.ts`, `e2e/smoke.spec.ts`.

**Interfaces:**
- Consumes: `getEnv()`, `getDb()`, `registerIndexes()`.
- Produces:
  - `interface SmsProvider { send(msg: {to: string; templateId: string; vars: Record<string,string>}): Promise<{providerMessageId: string}> }`
  - `interface EmailProvider { send(msg: {to: string; subject: string; html: string; text: string}): Promise<{providerMessageId: string}> }`
  - `interface PaymentGateway { createOrder(i: {amountPaise: number; receipt: string; notes?: Record<string,string>}): Promise<{gatewayOrderId: string}>; fetchPayment(id: string): Promise<{id: string; orderId: string; amountPaise: number; status: "captured"|"failed"|"authorized"}>; verifySignature(i: {orderId: string; paymentId: string; signature: string}): boolean; refund(i: {paymentId: string; amountPaise: number; idempotencyKey: string}): Promise<{refundId: string}> }`
  - `interface FileStore { put(path: string, body: Uint8Array, contentType: string): Promise<void>; get(path: string): Promise<{body: Uint8Array; contentType: string} | null>; delete(path: string): Promise<void> }`
  - `getDeps(): Deps` where `Deps = {sms; email; payments; files; now: () => Date}`. Chosen by env `SMS_PROVIDER|EMAIL_PROVIDER|PAYMENTS_PROVIDER|FILE_STORE` (default mock/fake/memory outside production).
  - `setDepsForTests(partial: Partial<Deps>): void`.
  - `readOutbox(to: string): Promise<OutboxMessage[]>` (dev and test only).

- [ ] **Step 1:** Write the failing tests:
  - `getDeps()` with `VERCEL_ENV=production` and mocks selected → throws `/mock providers are not allowed in production/i`;
  - mock SMS `send` → `readOutbox("+919876543210")` returns 1 message with the vars;
  - fake gateway `verifySignature` true only for its own HMAC;
  - e2e `smoke.spec.ts`: `/` renders "Aarvion" and `/api/health` returns 200.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm test:unit && pnpm test:int && pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5:** Commit `test(e2e): add Playwright harness and mock provider container`. Then PR and merge when green.

## After Phase F
Phase F5–F8 (tokens, primitives, layout shell, legal pages) start once DESIGN.md exists from the design track; their plan is written then, from DESIGN.md and the approved prototypes.
