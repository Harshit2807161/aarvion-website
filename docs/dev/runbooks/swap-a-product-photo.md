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
   `git checkout -- assets/products/cutout/<other>.webp` (not verified here). Run `git status` and
   confirm only `assets/products/cutout/<slug>.webp` changed, or every product's hash churns.
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
   `design/prototype/assets/banners/*` and their `.json` sidecars; not verified here). Then copy
   the served pair **unchanged** into `public/banners/`: `<scene>-1792.webp`, `<scene>-m.webp`
   and both `.json` sidecars (not the 1280). `scripts/public-provenance.test.ts` (in
   `pnpm test:unit`) must pass: exact file set, sidecars with `generator`
   `scripts/composite_store_banners.py`, 1792 × 588 and 840 × 472, at most 120 KB each.
8. Update the product's Photos column in `docs/dev/data.md`.
9. CHANGELOG → Changed:
   `- <Name> now shows Aarvion-branded pack photos (imageSource aarvion) (#<pr>).`

## Existing databases

The seed does not update existing products, so the new `images` and `cutout` reach a database
only through:
- **a targeted update before phase D** (not verified here; on Preview or Production only with
  the owner's OK, recorded in `docs/decisions/rulings.md`): in mongosh,
  `db.products.updateOne({ slug: "<slug>" }, { $set: { images, cutout, imageSource: "aarvion", updatedAt: new Date() } })`.
  Build each `images[]` entry as `{ src, width, height, alt }` from the new
  `data/product-images.json` entry, hero first, and **drop its `from` field** (the public product
  would otherwise expose the repo path). Alt text follows the seed: `"<Name> pack, photo 1 of N"`
  for photos and `"<Name> pack"` for the cutout;
- **phase D admin (planned):** "upload or replace photos", with the "needs photo swap" filter
  listing every `win2age` product, and `revalidateCatalogue()` on save;
- **dropping and reseeding:** only your local docker database (or a fresh one) with no admin
  edits, orders or carts to keep; check `db.getName()` first; **never Preview or Production**.

## What changes on the site

- The product page's Win2Age caption disappears when `imageSource` is no longer `win2age`
  (UI plan Task 32, planned).
- The banner rule still holds: a Win2Age pack never leads a banner (DESIGN.md).

## Files touched

`assets/products/original/*`, `assets/products/cutout/<slug>.webp`, `data/products.json`,
`data/product-images.json`, `public/products/<slug>/*`, possibly
`scripts/sync-product-images.test.ts`, `design/prototype/assets/banners/*` and
`public/banners/*`, `docs/dev/data.md`, `CHANGELOG.md`.
