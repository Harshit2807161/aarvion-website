# Catalogue data

## Sources of truth

| File | Role | Edited by |
| --- | --- | --- |
| `data/products.json` | the seed source: 11 listed products | hand, through a PR (see the runbooks) |
| `data/product-images.json` | manifest of served images | `pnpm images:sync` only |
| `public/products/<slug>/` | served, content-hashed images | `pnpm images:sync` only |
| `assets/products/original/` | source photos (WebP) | hand |
| `assets/products/cutout/<slug>.webp` | transparent cutout of each hero photo | `scripts/make_cutouts.py` or hand |
| `src/server/catalogue/categories.ts` | the 8 categories (`CATEGORY_LIST`) | code change |
| `data/source/` | the Drive-folder analysis (file list, OCR, mapping) | not edited |
| `docs/catalogue.md`, `docs/missing-products.md` | the full 32-line catalogue and the 20 products without photos | hand |

Do **not** re-run `scripts/build_stage0_docs.py`. It was the Stage 0 generator and rewrites
`data/products.json`, `docs/catalogue.md` and `docs/missing-products.md` from its own hard-coded
table, discarding later edits.

## `products.json`

Top level (zod `CatalogueJson`, strict): `_comment` (optional), `defaultMrpPaise` (must be
`40400`), `products[]` (slugs unique). Each product (zod `ProductJson`, strict, exactly 20 keys):

| Field | Type | Rule |
| --- | --- | --- |
| `slug` | string | lowercase words joined by hyphens, ≤ 64 chars; the URL `/product/<slug>`; unique |
| `name` | string | display name, e.g. "Sacuwin 50" |
| `familySlug` | slug | groups strengths of one brand (e.g. `sacuwin`) for the variant switcher |
| `variantLabel` | string \| null | strength label (`"50"`, `"R40"`, `"50/500"`); variants sort by its leading number |
| `category` | category slug | one of the 8 in `CATEGORY_SLUGS` |
| `composition` | `[{ ingredient, strength }]` | at least one; searched by ingredient |
| `dosageForm` | string | e.g. "Film-coated tablet" |
| `packLabel` | string | e.g. "Strip of 14 tablets", "10 ml" |
| `mrpPaise` | int ≥ 2100 \| null | MRP from the pack's back panel, in paise; `null` when unreadable |
| `mrpSource` | `"pack-back-panel"` \| `"default"` | `"default"` exactly when `mrpPaise` is `null` |
| `schedule` | `"H"` \| `"H1"` \| `"G"` \| `"OTC"` | `H` and `H1` require `rxRequired: true` |
| `rxRequired` | boolean | every current product is `true` |
| `manufacturer` | string \| null | `null` when unreadable (explain in `notes`) |
| `marketer` | string | |
| `images` | string[] | repo-relative WebP paths under `assets/products/original/`, in display order |
| `heroImage` | string | one of `images`; it becomes the first image |
| `imageSource` | `"aarvion"` \| `"win2age"` \| `"unbranded"` \| `"placeholder"` | what the photo shows; drives the Win2Age caption and the planned "needs photo swap" filter |
| `active` | boolean | inactive products are never public |
| `sortOrder` | int | shelf order within the catalogue |
| `notes` | string \| null | internal; stored as `internalNotes`, never public |

Current products (price = MRP − ₹20):

| Slug | Category | MRP | Price | Photos | `sortOrder` |
| --- | --- | --- | --- | --- | --- |
| `bemptor-r40` | cardiology | ₹630 | ₹610 | win2age | 0 |
| `bemptor-180` | cardiology | ₹380 | ₹360 | win2age | 1 |
| `sacuwin-100` | cardiology | ₹407 | ₹387 | aarvion | 4 |
| `sacuwin-200` | cardiology | ₹290 | ₹270 | aarvion | 5 |
| `sacuwin-50` | cardiology | ₹281 | ₹261 | aarvion | 6 |
| `vildage-m-50-500` | diabetology | ₹185 | ₹165 | win2age | 20 |
| `hyloage` | ophthalmology | ₹425 | ₹405 | win2age | 25 |
| `sysnet-ultra` | ophthalmology | ₹416 | ₹396 | win2age | 26 |
| `caftop` | ophthalmology | ₹263 | ₹243 | unbranded | 27 |
| `oloage-kt` | ophthalmology | ₹209 | ₹189 | win2age | 28 |
| `mucohelp` | respiratory | ₹209 | ₹189 | win2age | 29 |

Open data questions live in each product's `notes` and in [handoff.md](../handoff.md): the
Bemptor-R40 MRP (read as ₹630, OCR said ₹650), the Hyloage and Sysnet Ultra manufacturers, and
whether Mucohelp is the right product. A controller ruling (UI phase) gives the Sacuwin family
the lowest `sortOrder` in Heart care so Aarvion-printed packs lead the first rail; that data
change lands with UI plan Task 7 (planned).

## Images

`pnpm images:sync` (`scripts/sync-product-images.ts`):

1. Reads `products.json`; for each product hashes every file in `images` and the cutout
   `assets/products/cutout/<slug>.webp` (SHA-256, first 8 hex characters) and reads its size with
   sharp.
2. Copies each file **byte for byte** to `public/products/<slug>/<sha8>.webp` (cutouts as
   `cutout-<sha8>.webp`). Sources must already be WebP; nothing is re-encoded.
3. Deletes any file or folder under `public/products/` that the manifest no longer names.
4. Writes `data/product-images.json`: per slug, `photos[]` and `cutout`, each
   `{ src, width, height, from }`, where `from` is the exact repo-relative source string.

The content hash changes the URL whenever a photo changes, so the CDN can cache images forever
and a Win2Age → Aarvion swap busts every cache. `scripts/sync-product-images.test.ts` (in
`pnpm test:unit`) fails if the manifest drifts from the sources, a target file is missing, or a
product has no cutout. Running `pnpm images:sync` on an unchanged tree changes nothing (verified
2026-11-18: 43 images for 11 products).

Banner composites (`scripts/composite_store_banners.py`, Python with Pillow) place the cutouts on
the generated scenes in `assets/banners/store/` and write `design/prototype/assets/banners/` with
`.json` provenance sidecars. Text is never baked into a banner.

## Seed

`pnpm seed` (`scripts/seed.ts`) validates `products.json`, maps each product with
`toProductDoc()` and upserts with `$setOnInsert` keyed on `slug`:

- `notes` becomes `internalNotes`; `heroImage` is dropped after its photo is moved first;
  alt text is generated ("Sacuwin 50 pack, photo 1 of 3");
- `mrpPaise: null` becomes `40400` with `mrpSource: "default"`;
- `createdAt` and `updatedAt` are the run time;
- categories come from `CATEGORY_LIST`.

It is **insert-only**: an existing document (and any admin edit to it) is never changed, and
re-runs report everything as `existing`. A product missing from the manifest exits 1 naming the
slug. Consequence: a change to an existing product or category in the JSON or code does not reach
a database that already has it. Apply it with the admin (phase D, planned), a targeted update, or
by dropping a dev database and seeding again. The runbooks say which.

## Categories

`CATEGORY_SLUGS` (the zod enum in `schema.ts`) and `CATEGORY_LIST` (`categories.ts`) define 8
categories with `status` and `sortOrder`:

| Slug | Name in code today | Shopper name (UI plan Task 8) | Status |
| --- | --- | --- | --- |
| `cardiology` | Cardiology | Heart care | live |
| `diabetology` | Diabetology | Diabetes care | live |
| `ophthalmology` | Eye care | Eye care | live |
| `respiratory` | Respiratory | Respiratory care | live |
| `gastroenterology` | Gastroenterology | Digestive care | coming_soon |
| `orthopaedics` | Orthopaedics | Bone and joint care | coming_soon |
| `urology` | Urology | Urinary care | coming_soon |
| `pain-management` | Pain Management | Pain Management | hidden |

- Only products in **live** categories are public: lists, search, slug lookups and families.
- **coming_soon** categories are listed but show no products.
- **hidden** categories resolve to `null` (their pages 404).
- Slugs never change; display names do. Because the seed is insert-only, the Task 8 rename
  reaches an existing database only after `db.categories.deleteMany({})` and `pnpm seed`.

## Prices

- `sellingPricePaise(mrpPaise)` in `src/server/catalogue/pricing.ts` is the only price function:
  MRP − 2000 paise, throwing `RangeError` below 2100 or for a non-integer. Constants:
  `MRP_DISCOUNT_PAISE = 2000`, `MIN_MRP_PAISE = 2100`, `DEFAULT_MRP_PAISE = 40400`.
- The price is never stored. `toPublicProduct()` adds `pricePaise` at read time and strips
  `internalNotes`, `mrpSource`, `createdAt` and `updatedAt`.
- Planned (UI plan): `percentOff(mrpPaise) = Math.floor(200000 / mrpPaise)` beside it; UI code
  renders prices only through `StampPrice`, `PriceInline` or `Rupees`, and
  `src/lib/price-source.test.ts` forbids `pricePaise`, `MRP_DISCOUNT_PAISE` or `- 2000` under
  `src/app/**` and `src/components/**`.
- Orders (O phase) will snapshot prices computed on the server; the browser is never trusted.

## Search

`listProducts({ q })` normalises the query (NFKD, strip marks, lowercase, non-alphanumerics to
spaces), caps it at 64 characters, and keeps products whose name, family slug and ingredients,
joined without spaces, contain every token. No regex is ever built from input. An empty
normalised query returns nothing.
