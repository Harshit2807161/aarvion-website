# Runbook: change an MRP

The selling price is never stored: it is always `sellingPricePaise(mrpPaise)` = MRP − ₹20. So
changing a price means changing the MRP, and nothing else.

There are two places an MRP lives: the seed source `data/products.json`, and the `products`
documents in each database. Because the seed is insert-only, editing the JSON does not change a
database that already has the product.

## A. Correct the seed data (code PR)

1. Branch: `git switch -c fix/<slug>-mrp origin/main` (after `git fetch origin`).
2. In `data/products.json`, set `mrpPaise` (integer paise, at least 2100) and set
   `mrpSource: "pack-back-panel"`. If the product had `mrpPaise: null` with `"default"`, change
   both: the schema requires `null` exactly when the source is `"default"`. Update or clear
   `notes` if it held the open question (for example Bemptor-R40's "Confirm.").
3. In `src/server/catalogue/pricing.test.ts`, set the expected price to the new MRP − 2000.
4. Find every other pin. Tests pin the **price** as well as the MRP (for example
   `tests/int/catalogue-queries.test.ts` pins `sacuwin-100` at `38700`), and UI tests will pin
   rupee strings, so grep all four:
   `grep -rnE "<old mrpPaise>|<old pricePaise>|₹<old mrp>|₹<old price>" src tests scripts e2e`.
5. Update the product's row in the `docs/dev/data.md` price table.
6. Check:

   ```sh
   pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build
   ```

7. CHANGELOG → Fixed for a correction of a misread MRP, Changed for a new printed MRP:
   `- <Name> MRP corrected to ₹<mrp> (price ₹<price>) (#<pr>).`

The design prototype (`design/prototype/`) reads `products.json` through its own generator; it is
a reference artefact and does not need regenerating for a price change.

## B. Change the MRP in a database

- **After phase D (planned):** use the admin product editor. It shows "selling price = MRP − ₹20"
  live, stores `mrpSource: "admin"`, writes the audit log, asks for confirmation on a change over
  25 %, and calls `revalidateCatalogue()` so the next page view shows the new price.
- **Before phase D: a targeted update** (not verified here). On a shared database (Preview or
  Production) only with the owner's OK, because it bypasses the audit log:

  ```js
  // mongosh, connected to the target database
  db.products.updateOne(
    { slug: "<slug>" },
    { $set: { mrpPaise: <paise>, mrpSource: "admin", updatedAt: new Date() } },
  )
  ```

  Record who changed what and why in `docs/decisions/rulings.md`.
- Dropping the database and seeding again is **only for your local docker database** (or a fresh
  one) with no admin edits, orders or carts to keep, and **never Preview or Production**: check
  `db.getName()` first, then follow [setup.md](../setup.md#first-run).
- Pages are cached and a direct database write is **not** expired: in
  Production the old price can show for up to 1 h, so until phase D, **edit, then redeploy**. Browsers may keep
  a page for 5 minutes; cart and checkout always reprice from Mongo
  ([environments.md](../../decisions/environments.md)).

## Files touched

`data/products.json`, `src/server/catalogue/pricing.test.ts`, any other test the grep in step 4
finds, `docs/dev/data.md`, `CHANGELOG.md`.

## Never

- Never store a price, write `- 2000` in UI code, or round a price or % off up.
- Never set an MRP below ₹21 (the schema rejects it).
- Never lead a headline or banner with the ₹20.
