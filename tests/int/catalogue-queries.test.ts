import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION } from "@/server/catalogue/collections";
import { DEFAULT_MRP_PAISE } from "@/server/catalogue/pricing";
import {
  getCategoryBySlug,
  getFamily,
  getProductBySlug,
  listProducts,
  listVisibleCategories,
} from "@/server/catalogue/queries";
import { CatalogueJson } from "@/server/catalogue/schema";
import { seedCatalogue, toProductDoc } from "@/server/catalogue/seed";
import { getDb } from "@/server/db/client";
import { ensureIndexes } from "@/server/db/indexes";
import "@/server/db/register-all";
import type { ImageManifest } from "../../scripts/sync-product-images";
import { startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(stopMemoryReplSet);

const now = new Date("2026-11-17T00:00:00Z");
const catalogue = CatalogueJson.parse(JSON.parse(readFileSync("data/products.json", "utf8")));
const manifest = JSON.parse(readFileSync("data/product-images.json", "utf8")) as ImageManifest;

beforeEach(async () => {
  const db = await getDb();
  await db.collection(PRODUCTS_COLLECTION).deleteMany({});
  await db.collection(CATEGORIES_COLLECTION).deleteMany({});
  await seedCatalogue(
    db,
    {
      categories: CATEGORY_LIST,
      products: catalogue.products.map((p) =>
        toProductDoc(p, manifest[p.slug]!, DEFAULT_MRP_PAISE, now),
      ),
    },
    now,
  );
});

const slugs = (ps: { slug: string }[]) => ps.map((p) => p.slug);

describe("listProducts", () => {
  it("lists all 11 in order with derived prices and no internal fields", async () => {
    const ps = await listProducts();
    expect(ps).toHaveLength(11);
    expect(ps[0]!.slug).toBe("sacuwin-50");
    expect(ps[10]!.slug).toBe("mucohelp");
    for (const p of ps) {
      expect(p.pricePaise).toBe(p.mrpPaise - 2000);
      expect(typeof p.id).toBe("string");
      for (const k of ["internalNotes", "mrpSource", "createdAt", "updatedAt", "_id"]) {
        expect(p).not.toHaveProperty(k);
      }
    }
  });

  it("filters by category", async () => {
    expect(slugs(await listProducts({ category: "ophthalmology" }))).toEqual([
      "hyloage",
      "sysnet-ultra",
      "caftop",
      "oloage-kt",
    ]);
    expect(await listProducts({ category: "urology" })).toEqual([]);
    expect(await listProducts({ category: "nope" })).toEqual([]);
  });

  it("searches literally", async () => {
    const sacu = ["sacuwin-50", "sacuwin-100", "sacuwin-200"];
    expect(slugs(await listProducts({ q: "sacu" })).sort()).toEqual([...sacu].sort());
    expect(slugs(await listProducts({ q: "valsartan" })).sort()).toEqual([...sacu].sort());
    expect(slugs(await listProducts({ q: "SACUWIN 100" }))).toEqual(["sacuwin-100"]);
    expect(slugs(await listProducts({ q: "bemptor-r40" }))).toEqual(["bemptor-r40"]);
    expect(await listProducts({ q: "eye drops" })).toHaveLength(4);
    expect(await listProducts({ q: ".*" })).toEqual([]);
    expect(await listProducts({ q: "metformin", category: "cardiology" })).toEqual([]);
  });
});

describe("getProductBySlug", () => {
  it("returns the public product", async () => {
    const p = await getProductBySlug("sacuwin-100");
    expect(p?.name).toBe("Sacuwin 100");
    expect(p?.pricePaise).toBe(38700);
    expect(await getProductBySlug("SACUWIN-100")).toBeNull();
    expect(await getProductBySlug("nope")).toBeNull();
  });

  it("hides inactive products", async () => {
    const db = await getDb();
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-100" }, { $set: { active: false } });
    expect(await getProductBySlug("sacuwin-100")).toBeNull();
  });

  it("hides products whose category is not live", async () => {
    const db = await getDb();
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-100" }, { $set: { category: "urology" } });
    expect(await getProductBySlug("sacuwin-100")).toBeNull();
    expect(slugs(await listProducts({ q: "sacuwin" }))).toEqual(["sacuwin-50", "sacuwin-200"]);
  });
});

describe("getFamily", () => {
  it("orders by numeric variant label", async () => {
    expect(slugs(await getFamily("sacuwin"))).toEqual(["sacuwin-50", "sacuwin-100", "sacuwin-200"]);
    expect(slugs(await getFamily("bemptor"))).toEqual(["bemptor-180", "bemptor-r40"]);
    expect(await getFamily("Bad Slug")).toEqual([]);
  });

  it("excludes an inactive member", async () => {
    const db = await getDb();
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-100" }, { $set: { active: false } });
    expect(slugs(await getFamily("sacuwin"))).toEqual(["sacuwin-50", "sacuwin-200"]);
  });

  it("excludes a member whose category is not live", async () => {
    const db = await getDb();
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "bemptor-r40" }, { $set: { category: "urology" } });
    expect(slugs(await getFamily("bemptor"))).toEqual(["bemptor-180"]);
  });
});

describe("categories", () => {
  it("lists visible categories only", async () => {
    expect(slugs(await listVisibleCategories())).toEqual([
      "cardiology",
      "diabetology",
      "ophthalmology",
      "respiratory",
      "gastroenterology",
      "orthopaedics",
      "urology",
    ]);
    expect(await getCategoryBySlug("pain-management")).toBeNull();
    expect((await getCategoryBySlug("ophthalmology"))?.name).toBe("Eye care");
    expect((await getCategoryBySlug("cardiology"))?.name).toBe("Heart care");
  });

  it("lists the shopper-facing names in order", async () => {
    expect((await listVisibleCategories()).map((c) => c.name)).toEqual([
      "Heart care",
      "Diabetes care",
      "Eye care",
      "Respiratory care",
      "Digestive care",
      "Bone and joint care",
      "Urinary care",
    ]);
  });

  it("leads Heart care with the Aarvion-printed Sacuwin packs", async () => {
    const cardio = await listProducts({ category: "cardiology" });
    expect(slugs(cardio)).toEqual([
      "sacuwin-50",
      "sacuwin-100",
      "sacuwin-200",
      "bemptor-r40",
      "bemptor-180",
    ]);
  });
});

describe("indexes", () => {
  it("creates the query indexes", async () => {
    const db = await getDb();
    await ensureIndexes(db);
    const names = (await db.collection(PRODUCTS_COLLECTION).indexes()).map((i) => i.name);
    expect(names).toContain("category_active_sortOrder");
    expect(names).toContain("familySlug_active");
  });
});
