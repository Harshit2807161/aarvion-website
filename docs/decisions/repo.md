# Repository decisions

## Branch protection on `main`

Applied by the repo owner after the CI PR merged (the check names must have
run at least once). Required checks are the job ids in `ci.yml` plus
`pr-title` from `pr-guards.yml`. Admins are not enforced so the owner can
bypass in an emergency; no review approvals are required (solo repo).

```sh
gh api -X PUT repos/Harshit2807161/aarvion-website/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "typecheck", "unit", "int", "build", "pr-title"]
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

## PR guards

- Title: Conventional Commits (`amannn/action-semantic-pull-request@v5`).
- Branch: `^(feat|fix|chore|ci|test|docs|refactor|perf|build)/[a-z0-9-]+$`; `dependabot/**` allowed.
- Size: over 400 changed lines fails. Excludes `pnpm-lock.yaml`, `data/**`,
  images (`webp|png|svg`), binary files and files whose first line contains
  `@generated shadcn`. Run locally with `pnpm pr-size origin/main`.
