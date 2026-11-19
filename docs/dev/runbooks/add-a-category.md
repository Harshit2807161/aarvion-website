# Runbook: add a category (or change one)

Categories are fixed in code: the slug is a zod enum (`CATEGORY_SLUGS` in
`src/server/catalogue/schema.ts`) and the list with names, statuses and order is `CATEGORY_LIST`
in `src/server/catalogue/categories.ts`. There are 8 today ([data.md](../data.md#categories)).
Making categories admin-editable is planned for phase D.

Naming rule: shoppers read plain "… care" names (Heart care, Eye care, Digestive care), never
therapy-area words (Cardiology, Ophthalmology) or the word "therapy". Slugs never change once
used, because they are URLs (`/category/<slug>`).

## A. Add a new category

1. Branch: `git fetch origin && git switch -c feat/category-<slug> origin/main`.
2. `src/server/catalogue/schema.ts`: add the slug to `CATEGORY_SLUGS`.
3. `src/server/catalogue/categories.ts`: add
   `{ slug, name, status, sortOrder }`. `status` is `live` (products visible), `coming_soon`
   (listed, no products) or `hidden` (resolves to nothing). Pick a `sortOrder` that places it.
4. Update the tests:
   - `src/server/catalogue/schema.test.ts` (the `CATEGORY_LIST` expectations);
   - `tests/int/seed.test.ts`: category counts (8 → 9 inserted / existing, and the document
     count);
   - `tests/int/catalogue-queries.test.ts`: `listVisibleCategories()` names and order.
5. Check:

   ```sh
   pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build
   ```

6. CHANGELOG → Added:
   `- <Name> category (<slug>), <status> (#<pr>).`
7. Existing databases: `pnpm seed` inserts the new category (insert-only) with that scope's
   `MONGODB_URI` and `MONGODB_DB` (not verified here for deployed databases). After UI plan
   Task 7, cached pages need `revalidateCatalogue()` (planned).

## B. Change a name, status or order

The seed inserts any category slug a database lacks, but never changes one it already has. So
editing `CATEGORY_LIST` updates new databases and the tests, while an existing database keeps its
old document until you change it:

- **a targeted update** (not verified here; on Preview or Production only with the owner's OK,
  recorded in `docs/decisions/rulings.md`):
  `db.categories.updateOne({ slug: "<slug>" }, { $set: { status: "live" } })` (or `name`,
  `sortOrder`);
- **all names at once:** the procedure #51 recorded in README ("Reseeding after the category
  rename") and `docs/decisions/rulings.md`: `db.categories.deleteMany({})` then `pnpm seed`,
  which is safe because nothing references a category document, then per-slug `updateOne` of
  product `sortOrder` if the shelf order changed. Never `db.products.deleteMany({})` outside a
  fresh or local database with no admin edits, orders or carts;
- **after phase D:** the admin (planned).

To take a `coming_soon` category live it also needs active products with photos
([add-a-product.md](add-a-product.md)). CHANGELOG → Changed:
`- <Name> category is now live (#<pr>).`

## Files touched

`src/server/catalogue/schema.ts`, `src/server/catalogue/categories.ts`, the tests above,
`docs/dev/data.md` (the category table), `CHANGELOG.md`.
