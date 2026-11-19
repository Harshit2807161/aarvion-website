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
- [Rotate a secret](runbooks/rotate-a-secret.md) (planned)
- [Handle a failed deploy](runbooks/handle-a-failed-deploy.md) (planned)

## Keeping these pages true

- A PR that adds or changes a command, script, env var, route, data rule, folder, convention or
  procedure updates the matching page here in the same PR. Stale docs are a review finding.
- Mark anything not yet built as **planned** and anything you could not run as **not verified
  here**.
- Commands on these pages were last run on 2026-11-19 (macOS, pnpm 12.10.1, main at `d6446b2`):
  `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` (32 files, 651 tests),
  `pnpm test:int` (18 files, 141 tests), `pnpm build`, `pnpm images:sync` (no diff) and
  `pnpm pr-size origin/main`.
  `pnpm db:indexes` and `pnpm seed` ran only through their int tests (in-memory replica set).
  `pnpm db:up`, `pnpm test:e2e` and anything on Vercel or Atlas were not run here.

## Other references

- Product and rules: [PRODUCT.md](../../PRODUCT.md), [requirements.md](../requirements.md),
  [catalogue.md](../catalogue.md), [missing-products.md](../missing-products.md).
- Decisions: [decisions/](../decisions/), especially [rulings.md](../decisions/rulings.md).
- Plans: [superpowers/plans/](../superpowers/plans/).
- Design: [DESIGN.md](../../DESIGN.md), [design/prototype/](../../design/prototype/).
- State of the build: [handoff.md](../handoff.md); history: [CHANGELOG.md](../../CHANGELOG.md).
