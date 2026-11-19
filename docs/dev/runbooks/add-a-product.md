# Runbook: add a product

Use this until the admin dashboard (phase D, planned) can add products without code. The 20
catalogue products without photos are listed in [docs/missing-products.md](../../missing-products.md).

## Before you start

- Photos: front, back and side of the pack on white, square, 1000 × 1000 or larger, **as WebP**
  (`pnpm images:sync` copies bytes and does not convert). The back panel must show the MRP and
  pack size.
- The product's category must be **live** for it to show; in a `coming_soon` category it stays
  hidden ([data.md](../data.md#categories)). To make a category live, see
  [add-a-category.md](add-a-category.md).
- Confirm the photos print Aarvion's name. A Win2Age-era pack is allowed as a placeholder with
  `imageSource: "win2age"`; another company's brand is never used.

## Steps

1. Branch: `git fetch origin && git switch -c feat/add-<slug> origin/main`.
2. Copy the photos to `assets/products/original/`, named like the existing ones:
   `<slug>--<n>--<description>.webp`.
3. Add a transparent cutout of the hero photo at `assets/products/cutout/<slug>.webp` (every
   product needs one; the drift test fails without it). `python3 -I scripts/make_cutouts.py .`
   (Pillow) regenerates **every** cutout from each `heroImage`; keep only yours with
   `git checkout -- assets/products/cutout/<other>.webp` for the rest (not verified here). Run
   `git status` and confirm only `assets/products/cutout/<slug>.webp` changed before the next
   step; otherwise every product's hash and URL churns.
4. Add the product to `data/products.json` with all 20 fields ([data.md](../data.md#productsjson)):
   - `mrpPaise` in paise from the back panel with `mrpSource: "pack-back-panel"`; if the MRP
     cannot be read, `mrpPaise: null` and `mrpSource: "default"` (the seed stores ₹404, price
     ₹384);
   - `schedule` from the pack; `rxRequired: true` for `H` and `H1`;
   - `familySlug` and `variantLabel` to join an existing family (e.g. another Sacuwin strength);
   - `sortOrder` after the category's existing products. In cardiology never go below the Sacuwin
     family (0–2): the Aarvion-printed packs lead Heart care (controller ruling in
     `docs/decisions/rulings.md`);
   - `imageSource` honestly (`aarvion`, `win2age`, `unbranded`);
   - anything unconfirmed goes in `notes` (internal only).
5. `pnpm images:sync`. It adds `public/products/<slug>/` and updates `data/product-images.json`.
6. Update the tests pinned to the catalogue:
   - `src/server/catalogue/pricing.test.ts`: add the slug and its price (MRP − 2000) and the new
     count. It calls `sellingPricePaise(p.mrpPaise)` on the raw JSON, which throws for a `null`
     MRP, so for an unknown-MRP product make the loop use
     `sellingPricePaise(p.mrpPaise ?? DEFAULT_MRP_PAISE)` and expect `38400`;
   - `src/server/catalogue/schema.test.ts` and `src/server/catalogue/seed.test.ts`: the product
     count (`toHaveLength(11)`, "all 11 products");
   - `tests/int/seed.test.ts`: the inserted and existing counts and the document count;
   - `tests/int/catalogue-queries.test.ts`: the count, the first and last slugs in order, and
     the family or category lists the product joins.
7. Update `docs/catalogue.md` (status → Listed), remove the row from
   `docs/missing-products.md`, and add the product to the table in `docs/dev/data.md`.
8. Check:

   ```sh
   pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build
   pnpm pr-size origin/main   # data/** and images are not counted
   ```

9. CHANGELOG, under `[Unreleased]` → Added:
   `- <Name> (<slug>) listed in <category> at MRP ₹<mrp>, price ₹<price> (#<pr>).`
10. Open the PR; merge through the gate ([ci.md](../ci.md#the-merge-gate)).

## Existing databases

The seed is insert-only, so running it adds the new product and changes nothing else:
`pnpm seed` locally, and for a deployed database run it with that scope's `MONGODB_URI` and
`MONGODB_DB` (not verified here). Once the UI plan's caching lands (Task 7), cached pages show
the product after `revalidateCatalogue()` (planned).

## Files touched

`assets/products/original/*`, `assets/products/cutout/<slug>.webp`, `data/products.json`,
`data/product-images.json`, `public/products/<slug>/*`, the tests in step 6,
`docs/catalogue.md`, `docs/missing-products.md`, `docs/dev/data.md`, `CHANGELOG.md`.
