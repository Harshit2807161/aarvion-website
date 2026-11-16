# Aarvion Pharmaceuticals website

Pre-build workspace (Stages 0–3). The app code starts in Stage 5 in the GitHub repo `Harshit2807161/aarvion-website`.

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
