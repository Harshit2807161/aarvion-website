// Run with: pnpm seed. Insert-only; safe to re-run. SEED_DATA_DIR overrides the data directory.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORY_LIST } from "../src/server/catalogue/categories.ts";
import { CatalogueJson } from "../src/server/catalogue/schema.ts";
import { seedCatalogue, toProductDoc } from "../src/server/catalogue/seed.ts";
import { closeMongo, getDb } from "../src/server/db/client.ts";
import type { ImageManifest } from "./sync-product-images.ts";

const dataDir =
  process.env.SEED_DATA_DIR ?? resolve(fileURLToPath(import.meta.url), "../../data");
const readJson = (name: string): unknown => JSON.parse(readFileSync(resolve(dataDir, name), "utf8"));

async function main() {
  const catalogue = CatalogueJson.parse(readJson("products.json"));
  const manifest = readJson("product-images.json") as ImageManifest;
  const now = new Date();
  const products = catalogue.products.map((p) => {
    const images = manifest[p.slug];
    if (!images) throw new Error(`Product "${p.slug}" is missing from product-images.json`);
    return toProductDoc(p, images, catalogue.defaultMrpPaise, now);
  });
  try {
    const report = await seedCatalogue(await getDb(), { categories: CATEGORY_LIST, products }, now);
    console.log(`categories: ${report.categories.inserted} inserted, ${report.categories.existing} existing`);
    console.log(`products: ${report.products.inserted} inserted, ${report.products.existing} existing`);
  } finally {
    await closeMongo();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
