import { readFileSync } from "node:fs";
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CARTS_COLLECTION, mutateCart, readCart } from "@/server/cart/carts";
import { addLine, type CartLine } from "@/server/cart/rules";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION } from "@/server/catalogue/collections";
import { DEFAULT_MRP_PAISE } from "@/server/catalogue/pricing";
import { getPurchasableBySlugs } from "@/server/catalogue/queries";
import { CatalogueJson } from "@/server/catalogue/schema";
import { seedCatalogue, toProductDoc } from "@/server/catalogue/seed";
import { getDb } from "@/server/db/client";
import "@/server/db/register-all";
import { HttpError } from "@/server/http";
import type { ImageManifest } from "../../scripts/sync-product-images";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

const catalogue = CatalogueJson.parse(JSON.parse(readFileSync("data/products.json", "utf8")));
const manifest = JSON.parse(readFileSync("data/product-images.json", "utf8")) as ImageManifest;
const SEEDED = new Date("2026-11-17T00:00:00Z");
const T1 = new Date("2026-11-27T04:30:00Z");
const T2 = new Date("2026-11-27T04:31:00Z");
const L = (slug: string, qty: number): CartLine => ({ slug, qty });
let uid: ObjectId;

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(stopMemoryReplSet);
beforeEach(async () => {
  const db = await getDb();
  await clearCollections(PRODUCTS_COLLECTION, CATEGORIES_COLLECTION, CARTS_COLLECTION);
  await seedCatalogue(
    db,
    {
      categories: CATEGORY_LIST,
      products: catalogue.products.map((p) =>
        toProductDoc(p, manifest[p.slug]!, DEFAULT_MRP_PAISE, SEEDED),
      ),
    },
    SEEDED,
  );
  uid = new ObjectId();
});

describe("mutateCart", () => {
  it("inserts a missing cart at rev 1, then updates with rev + 1", async () => {
    const first = await mutateCart(uid, T1, (ls) => addLine(ls, "a"));
    expect(first).toEqual({ lines: [L("a", 1)], blocked: null, trimmed: false });
    expect(await readCart(uid)).toEqual({
      _id: uid,
      lines: [L("a", 1)],
      rev: 1,
      createdAt: T1,
      updatedAt: T1,
    });
    await mutateCart(uid, T2, (ls) => addLine(ls, "a"));
    expect(await readCart(uid)).toMatchObject({
      lines: [L("a", 2)],
      rev: 2,
      createdAt: T1,
      updatedAt: T2,
    });
  });

  it("writes nothing when the function returns the array it was given", async () => {
    await mutateCart(uid, T1, (ls) => addLine(ls, "a", 10));
    const refused = await mutateCart(uid, T2, (ls) => addLine(ls, "a"));
    expect(refused.blocked).toBe("product_limit");
    expect(await readCart(uid)).toMatchObject({ rev: 1, updatedAt: T1 });
    const empty = await mutateCart(new ObjectId(), T2, (ls) => ({ lines: ls }));
    expect(empty.lines).toEqual([]);
    expect(
      await (await getDb()).collection(CARTS_COLLECTION).countDocuments({ _id: empty as never }),
    ).toBe(0);
  });

  it("a missing cart whose function changes nothing is not created", async () => {
    await mutateCart(uid, T1, (ls) => ({ lines: ls }));
    expect(await readCart(uid)).toBeNull();
  });

  it("passes blocked and trimmed through", async () => {
    const out = await mutateCart(uid, T1, (ls) => ({ lines: [...ls, L("a", 1)], trimmed: true }));
    expect(out).toMatchObject({ blocked: null, trimmed: true });
  });

  it("parallel writers on a new cart all land: no lost write and rev counts every write", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () => mutateCart(uid, T1, (ls) => addLine(ls, "a"))),
    );
    expect(await readCart(uid)).toMatchObject({ lines: [L("a", 10)], rev: 10 });
  });

  it("gives up with 409 cart_conflict after maxAttempts lost races, and loses no acknowledged write", async () => {
    await mutateCart(uid, T1, (ls) => addLine(ls, "seed"));
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        mutateCart(uid, T2, (ls) => ({ lines: [...ls, L(`s${i}`, 1)] }), 1),
      ),
    );
    const lost = results.filter((r) => r.status === "rejected");
    expect(lost.length).toBeGreaterThan(0);
    for (const r of lost) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(HttpError);
      expect((r as PromiseRejectedResult).reason).toMatchObject({
        status: 409,
        code: "cart_conflict",
      });
    }
    const won = results.length - lost.length;
    expect((await readCart(uid))!.lines).toHaveLength(1 + won);
  });
});

describe("getPurchasableBySlugs", () => {
  it("returns the cart-line fields, with the cutout (else the first photo) as the image", async () => {
    const found = await getPurchasableBySlugs(["sacuwin-100", "mucohelp"]);
    expect([...found.keys()].toSorted()).toEqual(["mucohelp", "sacuwin-100"]);
    const p = found.get("sacuwin-100")!;
    expect(Object.keys(p).toSorted()).toEqual(
      [
        "composition",
        "dosageForm",
        "image",
        "mrpPaise",
        "name",
        "packLabel",
        "rxRequired",
        "slug",
      ].toSorted(),
    );
    expect(p.mrpPaise).toBe(40700);
    expect(p.image.src).toMatch(/^\/products\//);
  });

  it("omits unknown, inactive and coming-soon products, and ignores malformed slugs", async () => {
    const db = await getDb();
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-50" }, { $set: { active: false } });
    const live = await getPurchasableBySlugs([
      "sacuwin-50",
      "sacuwin-100",
      "nope",
      "../x",
      "A B",
      "",
    ]);
    expect([...live.keys()]).toEqual(["sacuwin-100"]);
    await db
      .collection(CATEGORIES_COLLECTION)
      .updateOne({ slug: "cardiology" }, { $set: { status: "coming_soon" } });
    expect((await getPurchasableBySlugs(["sacuwin-100"])).size).toBe(0);
  });

  it("is never cached: a changed MRP shows on the next read", async () => {
    const db = await getDb();
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-100" }, { $set: { mrpPaise: 50000 } });
    expect((await getPurchasableBySlugs(["sacuwin-100"])).get("sacuwin-100")!.mrpPaise).toBe(50000);
  });

  it("takes no query for no slugs, and refuses more than 20 distinct slugs", async () => {
    expect((await getPurchasableBySlugs([])).size).toBe(0);
    const many = Array.from({ length: 21 }, (_, i) => `s-${i}`);
    await expect(getPurchasableBySlugs(many)).rejects.toThrow(RangeError);
    expect((await getPurchasableBySlugs([...many.slice(0, 19), ...many.slice(0, 19)])).size).toBe(
      0,
    );
  });
});
