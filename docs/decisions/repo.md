# Repository decisions

## Branch protection on `main`

**Status: NOT applied.** The GitHub API returned 403 "Upgrade to GitHub Pro or
make this repository public" for branch protection on this private repo. Until
that changes, the gate is enforced by process.

**Required checks (one list):** `lint`, `typecheck`, `unit`, `int`, `build`,
`e2e` (job ids in `ci.yml`) and `pr-title` (`pr-guards.yml`).

**Process gate:** merge only when every check above is present in
`gh pr checks <n>` and passing, verified by name. "Everything shown is green"
is not enough: a workflow that never triggered shows nothing, and the PR-guard
checks alone would look green. A missing or pending required check blocks.

The intended rule, kept for later: admins are not enforced so the owner can
bypass in an emergency; no review approvals are required (solo repo). Apply
after the check names have run at least once:

```sh
gh api -X PUT repos/Harshit2807161/aarvion-website/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "typecheck", "unit", "int", "build", "e2e", "pr-title"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "required_linear_history": true,
  "restrictions": null
}
JSON
```

`branch-name` and `pr-size` run on every PR but are advisory, not required.

Action versions currently in use: `actions/checkout@v7`, `actions/setup-node@v7`,
`actions/cache@v6`, `pnpm/action-setup@v4`, `amannn/action-semantic-pull-request@v6`.

## PR guards

- Title: Conventional Commits (`amannn/action-semantic-pull-request@v6`).
- Branch: `^(feat|fix|chore|ci|test|docs|refactor|perf|build)/[a-z0-9-]+$`; `dependabot/**` allowed.
- Size: over 400 changed lines fails. Excludes `pnpm-lock.yaml`, `data/**`,
  images (`webp|png|svg`), binary files and files whose first line contains
  `@generated shadcn`. Run locally with `pnpm pr-size origin/main`.
