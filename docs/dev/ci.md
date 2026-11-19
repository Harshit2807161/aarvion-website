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

- `pnpm-lock.yaml`, `data/**`, `docs/superpowers/**`, `docs/decisions/**`, `public/**` (since #48);
- `**/*.webp`, `**/*.png`, `**/*.svg` and binary rows;
- files whose first line contains `@generated shadcn`.

Everything else counts, including `docs/dev/**`, `docs/plan/**`, `AGENTS.md`, `CHANGELOG.md`,
`scripts/merge-gate.sh` and tests. Because `public/**` is excluded, keep code out of `public/`:
it would not be counted. **Every PR must pass it, docs included** (owner, 2026-11-18, when the
1,740-line docs PR #47 was split; recorded in `docs/decisions/rulings.md`).
Earlier phases treated it as advisory and let a few PRs land over 400 by ruling
(`docs/decisions/phase-ca-ledger.md`); that no longer applies. A PR over 400 is split along
commit or file seams into PRs cut fresh from `origin/main` (with cherry-picks or
`git checkout <branch> -- <paths>`). Tests are never dropped to fit, and the guard is never
changed to pass. The UI plan also lists `assets/fonts/*.txt` (from its Task 2) as excluded; that
exclude lands with that task.

## The merge gate

GitHub branch protection is **not applied**: the API answers 403 for a private repo on the free
plan ([docs/decisions/repo.md](../decisions/repo.md), which also holds the protection payload for
when the repo goes public or Pro). The gate is enforced by process.

1. Wait for the checks: `gh pr checks <n> --watch --interval 20`. A brand-new PR may report "no
   checks" for a few seconds.
2. Read `gh pr checks <n>` and confirm **each of these nine by name shows `pass`**: `lint`,
   `typecheck`, `unit`, `int`, `build`, `e2e`, `pr-title`, `branch-name`, `pr-size`. A missing
   check (a workflow that never triggered) or a pending one blocks. "Everything shown is green"
   is not enough.
3. Merge with `gh pr merge <n> --squash`. Never pass `--delete-branch`; the owner is asked
   before any remote branch is deleted.
4. Only the authorised controller merges (see [AGENTS.md](../../AGENTS.md#branches-commits-and-prs)).
   Otherwise, ask a human.

The squash commit on `main` is the PR title plus `(#n)`; its body is the branch's commit messages
unless a body file is passed.

**`scripts/merge-gate.sh <pr-number> [body-file]`** runs steps 1–3 (it needs an authenticated
`gh`):
- it waits for the checks to register and finish, then requires all nine checks above to show
  `pass` by name, and stops with `BLOCKED: required check '<name>' not passing` otherwise;
- `ALLOW_OVERSIZE=1 scripts/merge-gate.sh <n>` drops `pr-size` from the list. Use it only for an
  exception with a ruling already recorded in `docs/decisions/rulings.md` (for example a design
  prototype import), and cite the ruling in the PR;
- it merges with `gh pr merge --squash` only: it never deletes branches and never force-merges
  (no `--admin`, no bypass of a failing check).

## Dependabot

`.github/dependabot.yml`:
- npm, weekly, commit prefix `chore(deps)`; semver-major `@types/node` bumps are ignored because
  the runtime is Node 24 (#9 was closed for that reason);
- GitHub Actions, monthly, commit prefix `ci(deps)`.

The prefixes make Dependabot titles pass `pr-title`, and its `dependabot/**` branches pass
`branch-name`. Merge a bump through the same gate when it is green; group bumps into one
CHANGELOG line per release. If two bumps conflict, comment `@dependabot rebase` on the stale one:
Dependabot then rewrites its own branch, which is allowed because no person's work is on it. We
never force-push. Closing the PR and letting Dependabot reopen it works too.

## Known gaps

- The UI plan's Global Constraints list "docs" as excluded from the size count; the script does
  not exclude them, and the owner keeps it that way, so docs PRs split like code PRs.
