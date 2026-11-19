# Runbook: swap a product photo (Win2Age → Aarvion)

Only Sacuwin 50, 100 and 200 have Aarvion-printed photos. The other 8 listed products are
placeholders until Aarvion-branded photos arrive: 7 packs printed under Win2Age Pharma,
Aarvion's earlier marketer (`imageSource: "win2age"`: `bemptor-r40`, `bemptor-180`,
`vildage-m-50-500`, `hyloage`, `sysnet-ultra`, `oloage-kt`, `mucohelp`), and `caftop`, whose
pack carries no mark (`"unbranded"`). This runbook replaces them with Aarvion photos.

## Before you start

- New photos: front, back and side, square, 1000 × 1000 or larger, white background, **WebP**
  (convert first; the pipeline copies bytes). The back panel must show the MRP and pack size; if
  the new pack prints a different MRP, also follow [change-an-mrp.md](change-an-mrp.md).

## Steps

1. Branch: `git fetch origin && git switch -c feat/<slug>-aarvion-photos origin/main`.
2. Add the photos to `assets/products/original/` as `<slug>--<n>--<description>.webp`. Remove
   the old Win2Age files once nothing in `products.json` references them
   (`grep -n "<old file>" data/products.json`).
3. In `data/products.json` for that product, set `images` (display order), `heroImage` (one of
   them) and `imageSource: "aarvion"`. Clear any `notes` the new photos answer.
4. Regenerate the cutout at `assets/products/cutout/<slug>.webp` from the new hero.
   `python3 -I scripts/make_cutouts.py .` rewrites every cutout; restore the others with
   `git checkout -- assets/products/cutout/<other>.webp` (not verified here).
5. `pnpm images:sync`. The new files get new content-hash names, so every CDN cache misses; the
   old files under `public/products/<slug>/` are deleted.
6. Tests that pin photo details: `scripts/sync-product-images.test.ts` expects 3 photos for
   `sacuwin-50` and 2 for `mucohelp`, and 1000 × 1000 for the first Sacuwin 50 photo; update them
   if you change those products. Then:

   ```sh
   pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build
   ```

7. Banners: if the product is in a banner (the Eye slide shows `hyloage`, `sysnet-ultra`,
   `caftop` and `oloage-kt`), re-composite with
   `python3 -I scripts/composite_store_banners.py .` (Pillow; writes
   `design/prototype/assets/banners/*` and their `.json` sidecars; not verified here). After UI
   plan Task 16 the served copies in `public/banners/` must be refreshed too (planned).
8. CHANGELOG → Changed:
   `- <Name> now shows Aarvion-branded pack photos (imageSource aarvion) (#<pr>).`

## Existing databases

The seed does not update existing products, so the new `images` and `cutout` reach a database
only through:
- **phase D admin (planned):** "upload or replace photos", with the "needs photo swap" filter
  listing every `win2age` product, and `revalidateCatalogue()` on save;
- **a dev database:** drop it and seed again;
- **a shared database before phase D** (owner's OK; not verified here): `$set` the product's
  `images`, `cutout` and `imageSource` from the new `data/product-images.json` entry, with alt
  text in the seed's format ("<Name> pack, photo 1 of N"), and record it in
  `docs/decisions/rulings.md`.

## What changes on the site

- The product page's Win2Age caption disappears when `imageSource` is no longer `win2age`
  (UI plan Task 32, planned).
- The banner rule still holds: a Win2Age pack never leads a banner (DESIGN.md).

## Files touched

`assets/products/original/*`, `assets/products/cutout/<slug>.webp`, `data/products.json`,
`data/product-images.json`, `public/products/<slug>/*`, possibly
`scripts/sync-product-images.test.ts`, `design/prototype/assets/banners/*`, `CHANGELOG.md`.
