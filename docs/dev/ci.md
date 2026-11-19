# CI, PR guards and the merge gate

## Workflows

**`.github/workflows/ci.yml`** runs on every pull request and on pushes to `main`. A newer push
to the same PR cancels the older run; runs on `main` are never cancelled. Permissions:
`contents: read`. Every job checks out, installs pnpm (`pnpm/action-setup@v6`) and Node from
`.nvmrc` (`actions/setup-node@v7`, pnpm cache), then `pnpm install --frozen-lockfile`.

| Job id | Runs | Notes |
| --- | --- | --- |
| `lint` | `pnpm lint` | |
| `typecheck` | `pnpm typecheck` | |
| `unit` | `pnpm test:unit` | the `unit` and `ui` Vitest projects |
| `int` | `pnpm test:int` | caches the mongod binary in `MONGOMS_DOWNLOAD_DIR` (`actions/cache@v6`, keyed on the lockfile) |
| `build` | `pnpm build` | |
| `e2e` | `playwright install --with-deps chromium`, `pnpm db:up`, `pnpm db:indexes`, `pnpm test:e2e` | `MONGODB_DB=aarvion_e2e`, `CI=true`; uploads the `playwright-report` artifact on failure (7 days) |

**`.github/workflows/pr-guards.yml`** runs when a PR is opened, edited, synchronised or
reopened.

| Job id | Checks |
| --- | --- |
| `pr-title` | Conventional Commit title (`amannn/action-semantic-pull-request@v6`); types `feat fix refactor test docs chore perf ci build` |
| `branch-name` | `^(feat\|fix\|chore\|ci\|test\|docs\|refactor\|perf\|build)/[a-z0-9-]+$`; `dependabot/**` allowed |
| `pr-size` | `scripts/pr-size.ts` against `origin/<base>`; fails over 400 changed lines |

## pr-size

`pnpm pr-size origin/main` sums added and deleted lines from `git diff --numstat
origin/main...HEAD`, skipping:

- `pnpm-lock.yaml`, `data/**`, `docs/superpowers/**`, `docs/decisions/**`;
- `**/*.webp`, `**/*.png`, `**/*.svg` and binary rows;
- files whose first line contains `@generated shadcn`.

Everything else counts, including `docs/dev/**`, `AGENTS.md`, `CHANGELOG.md` and tests. The check
is **advisory**: a docs-only PR may exceed it (ruling in `docs/decisions/phase-ca-ledger.md`).
For code, a PR over 400 is split along commit seams into sequential PRs (`<branch>-a`, then
`<branch>-b` after A merges), each cut fresh from `origin/main` with cherry-picks. Tests are never
dropped to fit. The UI plan also lists `public/**` (from its Task 16) and `assets/fonts/*.txt`
(from its Task 2) as excluded; those excludes land with those tasks.

## The merge gate

GitHub branch protection is **not applied**: the API answers 403 for a private repo on the free
plan ([docs/decisions/repo.md](../decisions/repo.md), which also holds the protection payload for
when the repo goes public or Pro). The gate is enforced by process.

1. Wait for the checks: `gh pr checks <n> --watch --interval 20`. A brand-new PR may report "no
   checks" for a few seconds.
2. Read `gh pr checks <n>` and confirm **each of these by name shows `pass`**: `lint`,
   `typecheck`, `unit`, `int`, `build`, `e2e`, `pr-title`, `branch-name`. A missing check (a
   workflow that never triggered) or a pending one blocks. "Everything shown is green" is not
   enough. `pr-size` may fail on an approved docs-only or ruled exception.
3. Merge with `gh pr merge <n> --squash`. Never pass `--delete-branch`; the owner is asked
   before any remote branch is deleted.
4. Only the authorised controller merges (see [AGENTS.md](../../AGENTS.md#branches-commits-and-prs)).
   Otherwise, ask a human.

The squash commit on `main` is the PR title plus `(#n)`; its body is the branch's commit messages
unless a body file is passed. The controller's local helper `.tools/merge-gate.sh` (gitignored,
in the owner's main checkout) runs exactly steps 1–3.

## Dependabot

`.github/dependabot.yml`:
- npm, weekly, commit prefix `chore(deps)`; semver-major `@types/node` bumps are ignored because
  the runtime is Node 24 (#9 was closed for that reason);
- GitHub Actions, monthly, commit prefix `ci(deps)`.

The prefixes make Dependabot titles pass `pr-title`, and its `dependabot/**` branches pass
`branch-name`. Merge a bump through the same gate when it is green; group bumps into one
CHANGELOG line per release. If two bumps conflict, comment `@dependabot rebase` on the stale one.

## Known gaps

- `docs/decisions/repo.md` still names `pnpm/action-setup@v4`; CI uses `@v6` since #6.
- `repo.md` lists seven required checks and calls `branch-name` advisory; the Phase CA ruling
  (and the controller's helper) also require `branch-name`. This page follows the stricter rule.
