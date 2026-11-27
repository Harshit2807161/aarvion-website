import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { MRP_DISCOUNT_PAISE, percentOff } from "../src/server/catalogue/pricing";

/**
 * [P55] Catalogue freshness: after an MRP changes in the database and the catalogue is expired
 * (`revalidateCatalogue()`, here through the dev-only POST /dev/catalogue/revalidate that the
 * e2e server allows), the product page and the home rails show the new price and % off on the next load. The page
 * is first loaded unchanged after the edit to prove it is cached. Pages are cached for hours,
 * so a stale price here would mean an admin edit never reaches customers.
 *
 * The test edits one product in the e2e database the way the admin editor will (mrpSource
 * "admin", MRP up by Rs 10) and puts it back afterwards, even when it fails. It talks to Mongo
 * directly because there is no admin API yet; when the admin product editor lands (phase D),
 * drive that instead of the update below. MONGODB_URI and the database name match
 * playwright.config.ts.
 *
 * Playwright runs spec files in parallel against one server and one cache, and nothing enforces
 * isolation, so the edited product must be one no other spec asserts the price of. This spec uses
 * mucohelp (Respiratory care): no other spec asserts its price, nor any Respiratory pocket's
 * (search.spec.ts only checks that mucohelp's pocket exists and takes focus; anchors.spec.ts only
 * that the rail exists), and the Respiratory category page is not price-asserted either. A spec
 * that starts to must pick another product or move this file to its own Playwright project;
 * catalogue.spec.ts and budgets.spec.ts assert sacuwin-100's price, which is why it is not used.
 */
const SLUG = "mucohelp";
const URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true";
const DB = "aarvion_e2e";

const price = (page: Page) => page.locator(`#p-${SLUG} .stamp-price`);

test("the product page and the home rails show a changed MRP after the catalogue is expired", async ({
  page,
  baseURL,
}) => {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5_000 });
  type Doc = { slug: string; mrpPaise: number; mrpSource: string; updatedAt: Date };
  let original: Doc | null = null;
  const products = () => client.db(DB).collection<Doc>("products");
  // The cache expiry goes through the request context, not the page, so it still works when
  // the page is gone (a timeout closes it). The Origin header is what the dev route requires.
  const expire = async () => {
    const res = await page.request.post("/dev/catalogue/revalidate", {
      headers: { origin: baseURL! },
    });
    expect(res.status()).toBe(204);
  };
  try {
    await client.connect();
    original = await products().findOne({ slug: SLUG });
    expect(original, `${SLUG} is seeded in ${DB}`).not.toBeNull();
    const { mrpPaise: before } = original!;

    await page.goto("/");
    await expect(price(page)).toContainText(`₹${(before - MRP_DISCOUNT_PAISE) / 100}`);
    await page.goto(`/product/${SLUG}`);
    await expect(page.locator("[data-hierarchy=price] .stamp-price")).toContainText(
      `₹${(before - MRP_DISCOUNT_PAISE) / 100}`,
    );

    const mrpPaise = before + 1000;
    await products().updateOne(
      { slug: SLUG },
      { $set: { mrpPaise, mrpSource: "admin", updatedAt: new Date() } },
    );
    // Still the old price: the page is served from the cache until it is expired.
    await page.goto(`/product/${SLUG}`);
    await expect(page.locator("[data-hierarchy=price] .stamp-price")).toContainText(
      `₹${(before - MRP_DISCOUNT_PAISE) / 100}`,
    );
    await expire();

    await page.goto(`/product/${SLUG}`);
    const buy = page.locator("[data-hierarchy=price]");
    await expect(buy.locator(".stamp-mrp")).toContainText(`MRP ₹${mrpPaise / 100}`);
    await expect(buy.locator(".off")).toContainText(`${percentOff(mrpPaise)}% off`);
    await expect(buy.locator(".stamp-price")).toContainText(
      `₹${(mrpPaise - MRP_DISCOUNT_PAISE) / 100}`,
    );

    await page.goto("/");
    await expect(page.locator(`#p-${SLUG} .stamp-mrp`)).toContainText(`₹${mrpPaise / 100}`);
    await expect(price(page)).toContainText(`₹${(mrpPaise - MRP_DISCOUNT_PAISE) / 100}`);
  } finally {
    // Three independent steps: each runs even if the one before it throws.
    try {
      if (original) {
        const { mrpPaise, mrpSource, updatedAt } = original;
        await products().updateOne({ slug: SLUG }, { $set: { mrpPaise, mrpSource, updatedAt } });
      }
    } finally {
      try {
        await expire();
      } finally {
        await client.close();
      }
    }
  }
});
