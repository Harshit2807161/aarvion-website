import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ObjectId } from "mongodb";
import { CATEGORY_LIST } from "../../src/server/catalogue/categories";
import { orderForShelf } from "../../src/server/catalogue/order";
import { toPublicProduct, type PublicProduct } from "../../src/server/catalogue/queries";
import { CatalogueJson, type Category, type Product } from "../../src/server/catalogue/schema";
import { toProductDoc } from "../../src/server/catalogue/seed";
import type { ImageManifest } from "../../scripts/sync-product-images";

const root = resolve(import.meta.dirname, "../..");
const readJson = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(root, "data", name), "utf8"));
const SEEDED_AT = new Date("2026-11-17T00:00:00Z");

/** Every product document the seed writes, from data/products.json and data/product-images.json. */
export function catalogueDocs(now: Date = SEEDED_AT): Product[] {
  const catalogue = CatalogueJson.parse(readJson("products.json"));
  const manifest = readJson("product-images.json") as ImageManifest;
  return catalogue.products.map((p) =>
    toProductDoc(p, manifest[p.slug]!, catalogue.defaultMrpPaise, now),
  );
}

/** The live categories, in sortOrder. */
export function catalogueCategories(): Category[] {
  return CATEGORY_LIST.filter((c) => c.status === "live").toSorted(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/** What the public queries return for the seed data, without a database: live and active only, in shelf order. */
export function publicCatalogue(): PublicProduct[] {
  const categories = catalogueCategories();
  const live = new Set<string>(categories.map((c) => c.slug));
  const products = catalogueDocs()
    .filter((p) => p.active && live.has(p.category))
    .map((p) => {
      const _id = new ObjectId(createHash("md5").update(p.slug).digest("hex").slice(0, 24));
      return toPublicProduct({ _id, ...p });
    });
  return orderForShelf(products, categories);
}
