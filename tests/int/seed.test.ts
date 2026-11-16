import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION } from "@/server/catalogue/collections";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { DEFAULT_MRP_PAISE } from "@/server/catalogue/pricing";
import { CatalogueJson, Product } from "@/server/catalogue/schema";
import { seedCatalogue, toProductDoc } from "@/server/catalogue/seed";
import { getDb } from "@/server/db/client";
import { ensureIndexes } from "@/server/db/indexes";
import "@/server/db/register-all";
import type { ImageManifest } from "../../scripts/sync-product-images";
import { startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

let uri: string;
beforeAll(async () => {
  uri = await startMemoryReplSet();
}, 120_000);
afterAll(stopMemoryReplSet);

const now = new Date("2026-11-17T00:00:00Z");
const catalogue = CatalogueJson.parse(JSON.parse(readFileSync("data/products.json", "utf8")));
const manifest = JSON.parse(readFileSync("data/product-images.json", "utf8")) as ImageManifest;
const products = () =>
  catalogue.products.map((p) => toProductDoc(p, manifest[p.slug]!, DEFAULT_MRP_PAISE, now));

beforeEach(async () => {
  const db = await getDb();
  await db.collection(PRODUCTS_COLLECTION).deleteMany({});
  await db.collection(CATEGORIES_COLLECTION).deleteMany({});
});

describe("seedCatalogue", () => {
  it("inserts once, then reports everything as existing", async () => {
    const db = await getDb();
    const input = { categories: CATEGORY_LIST, products: products() };
    expect(await seedCatalogue(db, input, now)).toEqual({
      categories: { inserted: 8, existing: 0 },
      products: { inserted: 11, existing: 0 },
    });
    expect(
      await seedCatalogue(db, { categories: CATEGORY_LIST, products: products() }, now),
    ).toEqual({
      categories: { inserted: 0, existing: 8 },
      products: { inserted: 0, existing: 11 },
    });
    expect(await db.collection(CATEGORIES_COLLECTION).countDocuments()).toBe(8);
    expect(await db.collection(PRODUCTS_COLLECTION).countDocuments()).toBe(11);
  });

  it("stores only Product keys", async () => {
    const db = await getDb();
    await seedCatalogue(db, { categories: CATEGORY_LIST, products: products() }, now);
    const docs = await db.collection(PRODUCTS_COLLECTION).find().toArray();
    expect(docs).toHaveLength(11);
    for (const { _id, ...doc } of docs) {
      expect(_id).toBeDefined();
      expect(Object.keys(doc).sort()).toEqual(Object.keys(Product.shape).sort());
    }
  });

  it("never overwrites admin edits on a re-run", async () => {
    const db = await getDb();
    await seedCatalogue(db, { categories: CATEGORY_LIST, products: products() }, now);
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-100" }, { $set: { mrpPaise: 41000, mrpSource: "admin" } });
    await seedCatalogue(db, { categories: CATEGORY_LIST, products: products() }, now);
    const doc = await db.collection<Product>(PRODUCTS_COLLECTION).findOne({ slug: "sacuwin-100" });
    expect(doc?.mrpPaise).toBe(41000);
    expect(doc?.mrpSource).toBe("admin");
  });

  it("has a unique slug index on products after ensureIndexes", async () => {
    const db = await getDb();
    await ensureIndexes(db);
    const idx = (await db.collection(PRODUCTS_COLLECTION).indexes()).find(
      (i) => i.name === "slug_unique",
    );
    expect(idx?.unique).toBe(true);
  });
});

function runSeed(env: Record<string, string>) {
  return spawnSync("pnpm", ["seed"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, MONGODB_URI: uri, ...env },
  });
}

describe("pnpm seed", () => {
  it("seeds, and is idempotent on a second run", () => {
    const env = { MONGODB_DB: "seed_script_test" };
    const first = runSeed(env);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("products: 11 inserted");
    const second = runSeed(env);
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain("products: 0 inserted, 11 existing");
  });

  it("exits 1 and names the slug when the manifest lacks a product", () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-data-"));
    cpSync("data", dir, { recursive: true });
    const file = join(dir, "product-images.json");
    const m = JSON.parse(readFileSync(file, "utf8"));
    delete m["hyloage"];
    writeFileSync(file, JSON.stringify(m));
    const r = runSeed({ MONGODB_DB: "seed_script_missing", SEED_DATA_DIR: dir });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("hyloage");
  });
});
