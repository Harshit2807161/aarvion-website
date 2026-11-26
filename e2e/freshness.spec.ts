import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";

/**
 * [P55] Catalogue freshness: after an MRP changes in the database and the catalogue is expired
 * (`revalidateCatalogue()`, here through the dev-only POST /dev/catalogue/revalidate that the
 * e2e server allows), the home rails show the new price on the next load. Pages are cached for
 * hours, so a stale price here would mean an admin edit never reaches customers.
 *
 * The test edits one product in the e2e database the way the admin editor will (mrpSource
 * "admin", MRP up by Rs 10) and puts it back afterwards, even when it fails. It talks to Mongo
 * directly because there is no admin API yet; when the admin product editor lands (phase D),
 * drive that instead of the update below. MONGODB_URI and the database name match
 * playwright.config.ts.
 */
const SLUG = "sacuwin-100";
const URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true";
const DB = "aarvion_e2e";

// Both tests change the same document, and any other spec that reads prices must not overlap.
test.describe.configure({ mode: "serial" });

const price = (page: Page) => page.locator(`#p-${SLUG} .stamp-price`);

async function expireCatalogue(page: Page): Promise<void> {
  const status = await page.evaluate(
    async () => (await fetch("/dev/catalogue/revalidate", { method: "POST" })).status,
  );
  expect(status).toBe(204);
}

test("the home rails show a changed MRP after the catalogue is expired", async ({ page }) => {
  const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5_000 }).connect();
  const products = client
    .db(DB)
    .collection<{ slug: string; mrpPaise: number; mrpSource: string }>("products");
  const before = await products.findOne({ slug: SLUG });
  expect(before, `${SLUG} is seeded in ${DB}`).not.toBeNull();
  try {
    await page.goto("/");
    await expect(price(page)).toContainText(`₹${(before!.mrpPaise - 2000) / 100}`);

    const mrpPaise = before!.mrpPaise + 1000;
    await products.updateOne(
      { slug: SLUG },
      { $set: { mrpPaise, mrpSource: "admin", updatedAt: new Date() } },
    );
    await expireCatalogue(page);

    await page.goto("/");
    await expect(page.locator(`#p-${SLUG} .stamp-mrp`)).toContainText(`₹${mrpPaise / 100}`);
    await expect(price(page)).toContainText(`₹${(mrpPaise - 2000) / 100}`);
  } finally {
    await products.updateOne(
      { slug: SLUG },
      { $set: { mrpPaise: before!.mrpPaise, mrpSource: before!.mrpSource } },
    );
    await page.goto("/");
    await expireCatalogue(page);
    await client.close();
  }
});
