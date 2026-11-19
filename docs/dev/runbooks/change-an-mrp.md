# Runbook: change an MRP

The selling price is never stored: it is always `sellingPricePaise(mrpPaise)` = MRP − ₹20. So
changing a price means changing the MRP, and nothing else.

There are two places an MRP lives: the seed source `data/products.json`, and the `products`
documents in each database. Because the seed is insert-only, editing the JSON does not change a
database that already has the product.

## A. Correct the seed data (code PR)

1. Branch: `git switch -c fix/<slug>-mrp origin/main` (after `git fetch origin`).
2. In `data/products.json`, set `mrpPaise` (integer paise, at least 2100) and keep
   `mrpSource: "pack-back-panel"`. Update or clear `notes` if it held the open question (for
   example Bemptor-R40's "Confirm.").
3. In `src/server/catalogue/pricing.test.ts`, set the expected price to the new MRP − 2000.
4. Find other tests that pin the old value: `grep -rn "<old mrpPaise>" src tests scripts e2e`.
5. Check:

   ```sh
   pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build
   ```

6. CHANGELOG → Changed:
   `- <Name> MRP corrected to ₹<mrp> (price ₹<price>) (#<pr>).`

The design prototype (`design/prototype/`) reads `products.json` through its own generator; it is
a reference artefact and does not need regenerating for a price change.

## B. Change the MRP in a database

- **After phase D (planned):** use the admin product editor. It shows "selling price = MRP − ₹20"
  live, stores `mrpSource: "admin"`, writes the audit log, asks for confirmation on a change over
  25 %, and calls `revalidateCatalogue()` so the next page view shows the new price.
- **Before phase D, on a dev database:** drop it and seed again ([setup.md](../setup.md#first-run)).
- **Before phase D, on a shared database** (not verified here; only with the owner's OK, since it
  bypasses the audit log):

  ```js
  // mongosh, connected to the target database
  db.products.updateOne(
    { slug: "<slug>" },
    { $set: { mrpPaise: <paise>, mrpSource: "admin", updatedAt: new Date() } },
  )
  ```

  Record who changed what and why in `docs/decisions/rulings.md`.
- Once the UI plan's caching lands (Task 7), a direct database write also needs a catalogue
  revalidation before cached pages show it (planned: the dev route
  `/dev/catalogue/revalidate`, and `revalidateCatalogue()` in admin writes).

## Never

- Never store a price, write `- 2000` in UI code, or round a price or % off up.
- Never set an MRP below ₹21 (the schema rejects it).
- Never lead a headline or banner with the ₹20.
