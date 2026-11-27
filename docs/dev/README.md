# Developer docs

How to set up, change, test, ship and operate the Aarvion storefront. Start with
[AGENTS.md](../../AGENTS.md) for the rules; these pages hold the detail.

| Page | Covers |
| --- | --- |
| [setup.md](setup.md) | Local dev: Node, pnpm, Docker Mongo, indexes, seed, env vars, the dev outbox |
| [architecture.md](architecture.md) | Folders, server modules, collections, request flow, caching plans |
| [testing.md](testing.md) | Test projects, how to write each kind, the guard tests |
| [ci.md](ci.md) | CI jobs, PR guards, pr-size, the merge gate, Dependabot |
| [data.md](data.md) | `products.json`, images, the seed, categories, prices |
| [deploy.md](deploy.md) | Vercel and Atlas plan, env vars per scope, production gates (planned) |

## Runbooks

Each runbook gives exact steps, commands, files touched, tests to run and the CHANGELOG line.

- [Add a product](runbooks/add-a-product.md)
- [Change an MRP](runbooks/change-an-mrp.md)
- [Swap a product photo (Win2Age → Aarvion)](runbooks/swap-a-product-photo.md)
- [Add a category](runbooks/add-a-category.md)
- [Rotate a secret](runbooks/rotate-a-secret.md)
- [Handle a failed deploy](runbooks/handle-a-failed-deploy.md)

## Keeping these pages true

- A PR that adds or changes a command, script, env var, route, data rule, folder, convention or
  procedure updates the matching page here in the same PR. Stale docs are a review finding.
- Mark anything not yet built as **planned** and anything you could not run as **not verified
  here**.
- Commands on these pages were last run on 2026-11-28 (macOS, pnpm 12.10.1, main at `b5cd2f5`):
  `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` (126 files, 2,109 tests),
  `pnpm test:int` (25 files, 236 tests; a first run can fail on `MongoMemoryServer` start-up when
  other worktrees run int tests at once, so rerun), `pnpm build`, `pnpm images:sync` (no diff)
  and `pnpm pr-size origin/main`. `pnpm test:e2e` ran in CI, and the cart spec locally against a
  production build on its own port. `pnpm db:up` and anything on Vercel or Atlas were not run
  here.

## Other references

- Product and rules: [PRODUCT.md](../../PRODUCT.md), [requirements.md](../requirements.md),
  [catalogue.md](../catalogue.md), [missing-products.md](../missing-products.md).
- Decisions: [decisions/](../decisions/), especially [rulings.md](../decisions/rulings.md).
- Plans: [superpowers/plans/](../superpowers/plans/).
- Design: [DESIGN.md](../../DESIGN.md), [design/prototype/](../../design/prototype/).
- State of the build: [handoff.md](../handoff.md); history: [CHANGELOG.md](../../CHANGELOG.md).
