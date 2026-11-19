# Aarvion Pharmaceuticals website

Pre-build workspace (Stages 0–3) plus the Next.js app (Stage 5).

- `docs/catalogue.md`: all 32 catalogue lines, listed vs missing
- `docs/missing-products.md`: 20 products with no photo, and how to add them later
- `docs/requirements.md`: requirements v0.1 (approval gate 1)
- `docs/review/`: published review pages (requirements, style round 1)
- `data/products.json`: seed data for the 11 listed products
- `data/source/`: Drive-folder analysis (file list, OCR, catalogue mapping)
- `assets/products/original/`: 32 product photos from Drive
- `assets/brand/`: logo drafts (SVG)
- `assets/banners/round1/`: AI banner scenes (Figma: Gemini 3.1 Flash Image and GPT Image 2.5) and pack composites
- `scripts/`: rebuild docs and seed data (`build_stage0_docs.py`) and banner composites (`composite_banners.py`)

Decided stack: Next.js 16 (App Router) + TypeScript, Node runtime, MongoDB, Vercel.

## Development

Requires Node 24 (`.nvmrc`) and pnpm 12. Copy `.env.example` to `.env.local`.

- `pnpm dev`: start the dev server
- `pnpm build` / `pnpm start`: production build and server. With Cache Components on, pages prerender from the catalogue, so the build needs `MONGODB_URI` and `MONGODB_DB` pointing at a seeded database (CI's `build` job seeds `aarvion_build`). Every Vercel scope needs the same at build time, plus Atlas network access from Vercel builds: see `docs/decisions/environments.md`
- `pnpm lint`, `pnpm typecheck`, `pnpm format`
- `pnpm test:unit`: Vitest `unit` (node, `src/**/*.test.ts` and `scripts/**/*.test.ts`) and `ui` (happy-dom, `src/**/*.test.tsx`, React plugin, `tests/helpers/ui-setup.ts`) projects; every test file must belong to exactly one project (`scripts/vitest-projects.test.ts`)
- `pnpm test:int`: Vitest `int` project (node, `tests/int/**/*.test.ts`); `tests/helpers/next-mocks.ts` mocks `connection()` and records the `next/cache` calls
- `pnpm test:e2e`: Playwright (Chromium) against a production build; needs Mongo, so run `pnpm db:up` first (it uses the `aarvion_e2e` database and a random `OTP_PEPPER`)
- `pnpm db:up && pnpm db:indexes && pnpm seed`: start Mongo, create indexes, seed the catalogue (insert-only, safe to re-run)
  - Reseeding after the category rename: the seed is insert-only, so an existing database keeps the old names and product order. (1) Always safe: in `mongosh`, run `db.categories.deleteMany({})`, then `pnpm seed`. (2) Product order, non-destructive: run `db.products.updateOne({ slug: "sacuwin-50" }, { $set: { sortOrder: 0 } })` and the same for `sacuwin-100` (1), `sacuwin-200` (2), `bemptor-r40` (3), `bemptor-180` (4). (3) `db.products.deleteMany({})` is only for a fresh or dev database with no admin edits, orders or carts, because product `_id` and `createdAt` change.

Route handlers (Cache Components is on): no `dynamic`, `revalidate` or `fetchCache` exports, and every `GET` starts with `await connection()`, followed in `src/app/dev/**` by `requireDevRoute()` (`src/server/route-config.test.ts`).

Catalogue caching: pages read the catalogue only through `src/lib/catalogue/cached.ts` (`'use cache'`, `cacheLife("hours")`, tag `catalogue`). Every catalogue write must call `revalidateCatalogue()`, which expires the tag at once; locally, `POST /dev/catalogue/revalidate` (same-origin, dev only) does the same.

Stack decisions: `docs/decisions/stack.md`.

## For maintainers and agents

- [AGENTS.md](AGENTS.md): the operating manual every coding agent (and human) reads first.
- [docs/dev/](docs/dev/README.md): setup, architecture, testing, CI, data, deploy and runbooks.
- [docs/handoff.md](docs/handoff.md): current state, what is next, open owner actions.
- [CHANGELOG.md](CHANGELOG.md): what changed, PR by PR.
