import { readFileSync } from "node:fs";
import { Collection, ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CARTS_COLLECTION, readCart } from "@/server/cart/carts";
import {
  addToCart,
  getCart,
  mergeGuestCart,
  quoteLines,
  removeFromCart,
  setCartQty,
} from "@/server/cart/service";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION } from "@/server/catalogue/collections";
import { cartTotals } from "@/server/catalogue/cart-totals";
import { DEFAULT_MRP_PAISE } from "@/server/catalogue/pricing";
import { CatalogueJson } from "@/server/catalogue/schema";
import { seedCatalogue, toProductDoc } from "@/server/catalogue/seed";
import { getDb } from "@/server/db/client";
import "@/server/db/register-all";
import { resetDepsForTests } from "@/server/deps";
import type { ImageManifest } from "../../scripts/sync-product-images";
import { installClock } from "../helpers/clock";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

const catalogue = CatalogueJson.parse(JSON.parse(readFileSync("data/products.json", "utf8")));
const manifest = JSON.parse(readFileSync("data/product-images.json", "utf8")) as ImageManifest;
const SEEDED = new Date("2026-11-17T00:00:00Z");
let clock: ReturnType<typeof installClock>;
let uid: ObjectId;

const slugsOf = (lines: readonly { slug: string }[]) => lines.map((l) => l.slug);
const doc = () => readCart(uid);
const retire = async (slug: string) =>
  (await getDb()).collection(PRODUCTS_COLLECTION).updateOne({ slug }, { $set: { active: false } });
const L = (slug: string, qty: number) => ({ slug, qty });

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(async () => {
  resetDepsForTests();
  await stopMemoryReplSet();
});

beforeEach(async () => {
  clock = installClock("2026-11-27T04:30:00Z");
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

describe("addToCart", () => {
  it("stores slugs and quantities only and prices the view from the catalogue", async () => {
    const res = await addToCart(uid, "sacuwin-100", 2, clock.now());
    expect(res.ok).toBe(true);
    expect(res.cart.totals).toEqual(cartTotals([{ mrpPaise: 40700, qty: 2 }]));
    expect(res.cart.lines.map((l) => [l.slug, l.qty])).toEqual([["sacuwin-100", 2]]);
    const stored = await doc();
    expect(stored!.lines).toEqual([L("sacuwin-100", 2)]);
    expect(stored!.rev).toBe(1);
    expect(JSON.stringify(stored)).not.toMatch(/Paise/);
  });

  it("each priced line carries what the cart and drawer show", async () => {
    const { cart } = await addToCart(uid, "sacuwin-100", 1, clock.now());
    const line = cart.lines[0]!;
    expect(Object.keys(line).toSorted()).toEqual(
      [
        "composition",
        "dosageForm",
        "image",
        "mrpPaise",
        "name",
        "packLabel",
        "qty",
        "rxRequired",
        "slug",
      ].toSorted(),
    );
    expect(line.image.src).toMatch(/^\/products\//);
  });

  it("an unknown or malformed slug is product_not_found and writes nothing", async () => {
    const res = await addToCart(uid, "nope", 1, clock.now());
    expect(res).toMatchObject({ ok: false, error: "product_not_found" });
    expect(await addToCart(uid, "../x", 1, clock.now())).toMatchObject({
      error: "product_not_found",
    });
    expect(await doc()).toBeNull();
  });

  it("a product in a coming-soon category is product_not_found", async () => {
    const db = await getDb();
    await db
      .collection(CATEGORIES_COLLECTION)
      .updateOne({ slug: "cardiology" }, { $set: { status: "coming_soon" } });
    const res = await addToCart(uid, "sacuwin-100", 1, clock.now());
    expect(res).toMatchObject({ ok: false, error: "product_not_found" });
    expect(await doc()).toBeNull();
  });

  it("refuses the 11th pack of one product and leaves rev alone", async () => {
    await addToCart(uid, "sacuwin-100", 10, clock.now());
    const before = await doc();
    const res = await addToCart(uid, "sacuwin-100", 1, clock.now());
    expect(res).toMatchObject({ ok: false, error: "product_limit" });
    expect(res.cart.totals.packs).toBe(10);
    expect((await doc())!.rev).toBe(before!.rev);
  });

  it("refuses the 21st pack of the order", async () => {
    await addToCart(uid, "sacuwin-50", 10, clock.now());
    await addToCart(uid, "sacuwin-100", 10, clock.now());
    const res = await addToCart(uid, "sacuwin-200", 1, clock.now());
    expect(res).toMatchObject({ ok: false, error: "order_limit" });
    expect((await doc())!.lines.reduce((n, l) => n + l.qty, 0)).toBe(20);
  });

  it("25 parallel adds over three slugs end at exactly 20 packs, none over 10, no write lost", async () => {
    const pick = ["sacuwin-50", "sacuwin-100", "sacuwin-200"];
    const calls = Array.from({ length: 25 }, (_, i) => pick[i % 3]!);
    const results = await Promise.all(calls.map((s) => addToCart(uid, s, 1, clock.now())));
    const okCount = results.filter((r) => r.ok).length;
    const stored = (await doc())!;
    expect(stored.lines.reduce((n, l) => n + l.qty, 0)).toBe(20);
    expect(Math.max(...stored.lines.map((l) => l.qty))).toBeLessThanOrEqual(10);
    expect(okCount).toBe(20);
    // the first ok result inserts the cart at rev 1; each later ok increments it once
    expect(stored.rev).toBe(okCount);
  });

  it("15 parallel adds of one slug end at 10", async () => {
    const results = await Promise.all(
      Array.from({ length: 15 }, () => addToCart(uid, "sacuwin-100", 1, clock.now())),
    );
    expect((await doc())!.lines).toEqual([L("sacuwin-100", 10)]);
    expect(results.filter((r) => r.ok)).toHaveLength(10);
  });
});

describe("retired lines never block a change", () => {
  it("an add counts only the lines that can still be bought, and prunes the rest", async () => {
    await addToCart(uid, "sacuwin-100", 10, clock.now());
    await addToCart(uid, "sacuwin-50", 10, clock.now());
    await retire("sacuwin-100");
    const res = await addToCart(uid, "sacuwin-200", 1, clock.now());
    expect(res.ok).toBe(true);
    expect(res.cart.removed).toEqual(["sacuwin-100"]);
    expect((await doc())!.lines).toEqual([L("sacuwin-50", 10), L("sacuwin-200", 1)]);
  });

  it("a refused change still writes the pruned cart", async () => {
    await addToCart(uid, "sacuwin-100", 10, clock.now());
    await addToCart(uid, "mucohelp", 10, clock.now());
    await retire("mucohelp");
    const res = await addToCart(uid, "sacuwin-100", 1, clock.now());
    expect(res).toMatchObject({ ok: false, error: "product_limit" });
    expect(res.cart.removed).toEqual(["mucohelp"]);
    expect((await doc())!.lines).toEqual([L("sacuwin-100", 10)]);
  });

  it("a merge drops retired server lines and retired guest lines before the cap", async () => {
    await addToCart(uid, "mucohelp", 10, clock.now());
    await addToCart(uid, "sacuwin-50", 5, clock.now());
    await retire("mucohelp");
    const out = await mergeGuestCart(
      uid,
      [L("ghost-1", 10), L("ghost-2", 10), L("sacuwin-100", 10), L("sacuwin-200", 5)],
      clock.now(),
    );
    expect(out.trimmed).toBe(false);
    expect(out.removed).toEqual(["mucohelp", "ghost-1", "ghost-2"]);
    expect(out.lines.map((l) => [l.slug, l.qty])).toEqual([
      ["sacuwin-50", 5],
      ["sacuwin-100", 10],
      ["sacuwin-200", 5],
    ]);
  });

  it("a read that loses the race to prune falls back to the unpruned view", async () => {
    await addToCart(uid, "sacuwin-100", 2, clock.now());
    await retire("sacuwin-100");
    const spy = vi
      .spyOn(Collection.prototype, "updateOne")
      .mockResolvedValue({ modifiedCount: 0 } as never);
    const cart = await getCart(uid, clock.now());
    spy.mockRestore();
    expect(cart).toMatchObject({ lines: [], removed: ["sacuwin-100"] });
    expect((await doc())!.lines).toEqual([L("sacuwin-100", 2)]);
  });
});

describe("races at the caps", () => {
  it("a cart at 10 packs plus 15 parallel adds of one pack ends at 20, no update lost", async () => {
    await addToCart(uid, "sacuwin-50", 10, clock.now());
    const pick = ["sacuwin-100", "sacuwin-200", "mucohelp"];
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, i) => addToCart(uid, pick[i % 3]!, 1, clock.now())),
    );
    const ok = results.filter((r) => r.ok).length;
    const stored = (await doc())!;
    expect(stored.lines.reduce((n, l) => n + l.qty, 0)).toBe(20);
    expect(ok).toBe(10);
    expect(Math.max(...stored.lines.map((l) => l.qty))).toBeLessThanOrEqual(10);
    expect(stored.rev).toBe(1 + ok);
  });

  it("getCart pruning a retired line while adds race loses none of them", async () => {
    await addToCart(uid, "sacuwin-100", 2, clock.now());
    await retire("sacuwin-100");
    await Promise.all([
      getCart(uid, clock.now()),
      ...Array.from({ length: 5 }, () => addToCart(uid, "sacuwin-50", 1, clock.now())),
    ]);
    expect((await doc())!.lines).toEqual([L("sacuwin-50", 5)]);
  });
});

describe("setCartQty and removeFromCart", () => {
  it("sets, and 0 removes the line", async () => {
    await addToCart(uid, "sacuwin-100", 2, clock.now());
    expect((await setCartQty(uid, "sacuwin-100", 5, clock.now())).ok).toBe(true);
    expect((await doc())!.lines).toEqual([L("sacuwin-100", 5)]);
    const res = await setCartQty(uid, "sacuwin-100", 0, clock.now());
    expect(res.ok).toBe(true);
    expect((await doc())!.lines).toEqual([]);
  });

  it("an unknown slug with qty > 0 is product_not_found; removing a retired line still works", async () => {
    expect(await setCartQty(uid, "nope", 2, clock.now())).toMatchObject({
      ok: false,
      error: "product_not_found",
    });
    await addToCart(uid, "sacuwin-100", 1, clock.now());
    const db = await getDb();
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-100" }, { $set: { active: false } });
    expect((await setCartQty(uid, "sacuwin-100", 0, clock.now())).ok).toBe(true);
    expect((await doc())!.lines).toEqual([]);
  });

  it("removeFromCart of an absent slug is ok and writes nothing", async () => {
    expect((await removeFromCart(uid, "sacuwin-100", clock.now())).ok).toBe(true);
    expect(await doc()).toBeNull();
  });

  it("refuses a set past the order limit", async () => {
    await addToCart(uid, "sacuwin-50", 10, clock.now());
    await addToCart(uid, "sacuwin-100", 5, clock.now());
    await addToCart(uid, "sacuwin-200", 5, clock.now());
    const res = await setCartQty(uid, "sacuwin-100", 10, clock.now());
    expect(res).toMatchObject({ ok: false, error: "order_limit" });
  });
});

describe("getCart reprices from Mongo", () => {
  it("uses the current MRP after a raw update", async () => {
    await addToCart(uid, "sacuwin-100", 2, clock.now());
    const db = await getDb();
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-100" }, { $set: { mrpPaise: 50000 } });
    const cart = await getCart(uid, clock.now());
    expect(cart.totals).toEqual(cartTotals([{ mrpPaise: 50000, qty: 2 }]));
  });

  it("drops a retired product once, in the same write, and says so once", async () => {
    await addToCart(uid, "sacuwin-100", 2, clock.now());
    await addToCart(uid, "sacuwin-50", 1, clock.now());
    const db = await getDb();
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-100" }, { $set: { active: false } });
    const first = await getCart(uid, clock.now());
    expect(first.removed).toEqual(["sacuwin-100"]);
    expect(slugsOf(first.lines)).toEqual(["sacuwin-50"]);
    expect(first.totals.packs).toBe(1);
    expect((await doc())!.lines).toEqual([L("sacuwin-50", 1)]);
    expect((await getCart(uid, clock.now())).removed).toEqual([]);
  });

  it("an empty or missing cart is all zeros and writes nothing", async () => {
    const cart = await getCart(uid, clock.now());
    expect(cart).toMatchObject({ lines: [], removed: [], totals: { payablePaise: 0 } });
    expect(await doc()).toBeNull();
  });
});

describe("mergeGuestCart", () => {
  it("merges by max, drops unknown slugs, and twice equals once", async () => {
    await addToCart(uid, "sacuwin-100", 2, clock.now());
    const guest = [L("sacuwin-100", 1), L("sacuwin-50", 3), L("ghost", 2)];
    const once = await mergeGuestCart(uid, guest, clock.now());
    expect(once.lines.map((l) => [l.slug, l.qty])).toEqual([
      ["sacuwin-100", 2],
      ["sacuwin-50", 3],
    ]);
    expect(once.trimmed).toBe(false);
    const rev = (await doc())!.rev;
    const twice = await mergeGuestCart(uid, guest, clock.now());
    expect(twice.lines).toEqual(once.lines);
    expect(twice.totals).toEqual(once.totals);
    expect((await doc())!.rev).toBe(rev);
  });

  it("two parallel merges of the same guest cart give one result", async () => {
    const guest = [L("sacuwin-50", 3), L("sacuwin-100", 2)];
    const [a, b] = await Promise.all([
      mergeGuestCart(uid, guest, clock.now()),
      mergeGuestCart(uid, guest, clock.now()),
    ]);
    expect(a.lines).toEqual(b.lines);
    expect((await doc())!.lines).toEqual(guest);
  });

  it("reports a trim when the merge passes 20 packs", async () => {
    await addToCart(uid, "sacuwin-50", 10, clock.now());
    await addToCart(uid, "sacuwin-100", 6, clock.now());
    const out = await mergeGuestCart(uid, [L("sacuwin-200", 10)], clock.now());
    expect(out.trimmed).toBe(true);
    expect(out.totals.packs).toBe(20);
  });
});

describe("quoteLines", () => {
  it("prices without writing a cart and lists non-purchasable slugs as removed", async () => {
    const view = await quoteLines([L("sacuwin-100", 2), L("ghost", 1)]);
    expect(view.totals).toEqual(cartTotals([{ mrpPaise: 40700, qty: 2 }]));
    expect(view.removed).toEqual(["ghost"]);
    expect(slugsOf(view.lines)).toEqual(["sacuwin-100"]);
    const db = await getDb();
    expect(await db.collection(CARTS_COLLECTION).countDocuments()).toBe(0);
  });
});
