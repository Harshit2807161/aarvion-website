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
- `pnpm build` / `pnpm start`: production build and server
- `pnpm lint`, `pnpm typecheck`, `pnpm format`
- `pnpm test:unit`: Vitest `unit` (node, `src/**/*.test.ts` and `scripts/**/*.test.ts`) and `ui` (happy-dom, `src/**/*.test.tsx`, React plugin, `tests/helpers/ui-setup.ts`) projects; every test file must belong to exactly one project (`scripts/vitest-projects.test.ts`)
- `pnpm test:int`: Vitest `int` project (node, `tests/int/**/*.test.ts`)
- `pnpm test:e2e`: Playwright (Chromium) against a production build; needs Mongo, so run `pnpm db:up` first (it uses the `aarvion_e2e` database and a random `OTP_PEPPER`)
- `pnpm db:up && pnpm db:indexes && pnpm seed`: start Mongo, create indexes, seed the catalogue (insert-only, safe to re-run)
  - Category names changed to shopper names (Heart care, Diabetes care, Eye care, Respiratory care, ...) and the Sacuwin packs now lead Heart care. The seed never overwrites, so an existing database keeps the old names and order until you reseed it: in `mongosh`, run `db.categories.deleteMany({})` and `db.products.deleteMany({})` (products too, for the order), then `pnpm seed`. Skip this on a database holding admin edits to products; set `sortOrder` there instead.

Stack decisions: `docs/decisions/stack.md`.
