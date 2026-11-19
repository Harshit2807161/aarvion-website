# Repository decisions

## Branch protection on `main`

**Status: APPLIED on 2026-11-19.** The owner made the repository public on 2026-11-19
(GitHub Actions minutes on a private Free repo had run out), and branch protection, which the
API refused with 403 while the repo was private, was then applied at the owner's request.

**Required checks (one list, nine):** `lint`, `typecheck`, `unit`, `int`, `build`,
`e2e` (job ids in `ci.yml`) and `pr-title`, `branch-name`, `pr-size`
(`pr-guards.yml`). `branch-name` has been required since the Phase CA pre-flight
ruling and `pr-size` since 2026-11-18 (see `rulings.md`).

**Merge gate:** GitHub now enforces the nine checks; `scripts/merge-gate.sh` still checks them by
name first (it also catches a check that never triggered). Merge only when every check above is present in
`gh pr checks <n>` and passing, verified by name. `scripts/merge-gate.sh <n>`
does this and squash-merges; `ALLOW_OVERSIZE=1` drops `pr-size` only for an
exception with a recorded ruling, and then merges with `--admin` because GitHub requires `pr-size`. "Everything shown is green"
is not enough: a workflow that never triggered shows nothing, and the PR-guard
checks alone would look green. A missing or pending required check blocks.

Applied settings: the nine checks above are required by name (not "up to date with main":
`strict` is off, so parallel PRs are not forced to re-merge main after every merge); linear
history is required (squash merges); force pushes and deletion of `main` are blocked; no review
approvals are required (solo repo); admins are not enforced, so the owner can bypass in an
emergency with `gh pr merge --admin`. Payload as applied:

```sh
gh api -X PUT repos/Harshit2807161/aarvion-website/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": false,
    "checks": [
      {"context": "lint"}, {"context": "typecheck"}, {"context": "unit"}, {"context": "int"},
      {"context": "build"}, {"context": "e2e"}, {"context": "pr-title"},
      {"context": "branch-name"}, {"context": "pr-size"}
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

`branch-name` and `pr-size` are required too (they were advisory until the rulings above).

Action versions currently in use: `actions/checkout@v7`, `actions/setup-node@v7`,
`actions/cache@v6`, `pnpm/action-setup@v6`, `amannn/action-semantic-pull-request@v6`.

## PR guards

- Title: Conventional Commits (`amannn/action-semantic-pull-request@v6`).
- Branch: `^(feat|fix|chore|ci|test|docs|refactor|perf|build)/[a-z0-9-]+$`; `dependabot/**` allowed.
- Size: over 400 changed lines fails, and every PR must pass it, docs included.
  Excludes `pnpm-lock.yaml`, `data/**`, `docs/superpowers/**`, `docs/decisions/**`,
  `public/**`, images (`webp|png|svg`), binary files and files whose first line
  contains `@generated shadcn`. Run locally with `pnpm pr-size origin/main`.
