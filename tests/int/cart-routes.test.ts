import { readFileSync } from "node:fs";
import { Collection } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "@/app/api/cart/items/[slug]/route";
import { POST as ADD } from "@/app/api/cart/items/route";
import { GET } from "@/app/api/cart/route";
import { SESSIONS_COLLECTION } from "@/server/auth/sessions";
import { USERS_COLLECTION } from "@/server/auth/users";
import { CARTS_COLLECTION } from "@/server/cart/carts";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION } from "@/server/catalogue/collections";
import { DEFAULT_MRP_PAISE } from "@/server/catalogue/pricing";
import { CatalogueJson } from "@/server/catalogue/schema";
import { seedCatalogue, toProductDoc } from "@/server/catalogue/seed";
import { getDb } from "@/server/db/client";
import "@/server/db/register-all";
import { resetDepsForTests } from "@/server/deps";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import type { ImageManifest } from "../../scripts/sync-product-images";
import { installClock } from "../helpers/clock";
import { getReq, jsonReq } from "../helpers/http";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";
import { signedIn } from "../helpers/session";

const catalogue = CatalogueJson.parse(JSON.parse(readFileSync("data/products.json", "utf8")));
const manifest = JSON.parse(readFileSync("data/product-images.json", "utf8")) as ImageManifest;
const SEEDED = new Date("2026-11-17T00:00:00Z");
let clock: ReturnType<typeof installClock>;
let errors: ReturnType<typeof vi.spyOn>;

const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const items = (body: unknown, cookie?: string, opts = {}) =>
  jsonReq("POST", "/api/cart/items", body, { cookie, ...opts });
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test reads arbitrary response JSON
const body = async (res: Response) => (await res.json()) as Record<string, any>;

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(async () => {
  resetDepsForTests();
  await stopMemoryReplSet();
});
beforeEach(async () => {
  clock = installClock("2026-11-27T04:30:00Z");
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const db = await getDb();
  await clearCollections(
    PRODUCTS_COLLECTION,
    CATEGORIES_COLLECTION,
    CARTS_COLLECTION,
    USERS_COLLECTION,
    SESSIONS_COLLECTION,
    RATE_LIMITS_COLLECTION,
  );
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
});

describe("auth, origin and validation", () => {
  it("answers 401 without a session, and 403 bad_origin without an Origin", async () => {
    expect((await GET(getReq("/api/cart"))).status).toBe(401);
    expect((await ADD(items({ slug: "sacuwin-100", qty: 1 }))).status).toBe(401);
    const { cookie } = await signedIn();
    const res = await ADD(items({ slug: "sacuwin-100", qty: 1 }, cookie, { origin: null }));
    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({ error: "bad_origin" });
  });

  it("answers 400 for a bad [slug] and a qty out of range", async () => {
    const { cookie } = await signedIn();
    const put = (slug: string, qty: unknown) =>
      PUT(
        jsonReq("PUT", `/api/cart/items/${encodeURIComponent(slug)}`, { qty }, { cookie }),
        slugCtx(slug),
      );
    expect((await put("Bad Slug", 1)).status).toBe(400);
    expect((await put("sacuwin-100", 11)).status).toBe(400);
    expect((await put("sacuwin-100", -1)).status).toBe(400);
    expect((await ADD(items({ slug: "sacuwin-100", qty: 11 }, cookie))).status).toBe(400);
    expect((await ADD(items({ slug: "sacuwin-100", qty: 0 }, cookie))).status).toBe(400);
  });
});

describe("items", () => {
  it("adds, sets and removes, always no-store and with the priced view", async () => {
    const { cookie } = await signedIn();
    const added = await ADD(items({ slug: "sacuwin-100", qty: 2 }, cookie));
    expect(added.status).toBe(200);
    expect(added.headers.get("cache-control")).toBe("no-store");
    const cart = await body(added);
    expect(cart.lines[0].qty).toBe(2);
    expect(cart.totals.packs).toBe(2);
    const got = await GET(getReq("/api/cart", { cookie }));
    expect((await body(got)).lines).toHaveLength(1);
    const set = await PUT(
      jsonReq("PUT", "/api/cart/items/sacuwin-100", { qty: 0 }, { cookie }),
      slugCtx("sacuwin-100"),
    );
    expect((await body(set)).lines).toEqual([]);
    for (let i = 0; i < 2; i++) {
      const del = await DELETE(
        jsonReq("DELETE", "/api/cart/items/sacuwin-100", undefined, { cookie }),
        slugCtx("sacuwin-100"),
      );
      expect(del.status).toBe(200);
    }
  });

  it("an unknown or retired product is 404 with the cart", async () => {
    const { cookie } = await signedIn();
    const res = await ADD(items({ slug: "nope", qty: 1 }, cookie));
    expect(res.status).toBe(404);
    const out = await body(res);
    expect(out.error).toBe("product_not_found");
    expect(out.cart.lines).toEqual([]);
    await (
      await getDb()
    )
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-100" }, { $set: { active: false } });
    const retired = await ADD(items({ slug: "sacuwin-100", qty: 1 }, cookie));
    expect(retired.status).toBe(404);
    expect((await body(retired)).error).toBe("product_not_found");
  });

  it("the caps answer 409 with the unchanged cart", async () => {
    const { cookie } = await signedIn();
    await ADD(items({ slug: "sacuwin-100", qty: 10 }, cookie));
    const res = await ADD(items({ slug: "sacuwin-100", qty: 1 }, cookie));
    expect(res.status).toBe(409);
    const out = await body(res);
    expect(out.error).toBe("product_limit");
    expect(out.cart.lines[0].qty).toBe(10);
    await ADD(items({ slug: "sacuwin-50", qty: 10 }, cookie));
    const order = await ADD(items({ slug: "sacuwin-200", qty: 1 }, cookie));
    expect(order.status).toBe(409);
    expect((await body(order)).error).toBe("order_limit");
  });

  it("is rate limited per user at 120 a minute with Retry-After", async () => {
    const { cookie } = await signedIn();
    for (let i = 0; i < 120; i++)
      await DELETE(
        jsonReq("DELETE", "/api/cart/items/sacuwin-100", undefined, { cookie }),
        slugCtx("sacuwin-100"),
      );
    const res = await DELETE(
      jsonReq("DELETE", "/api/cart/items/sacuwin-100", undefined, { cookie }),
      slugCtx("sacuwin-100"),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).not.toBeNull();
    expect((await body(res)).error).toBe("rate_limited");
  }, 60_000);
});

describe("the sliding cookie", () => {
  it("is re-issued once the session slid, and not before", async () => {
    const { cookie } = await signedIn();
    clock.advance(30_000);
    expect((await GET(getReq("/api/cart", { cookie }))).headers.get("set-cookie")).toBeNull();
    clock.advance(2 * 60_000);
    const res = await GET(getReq("/api/cart", { cookie }));
    expect(res.headers.get("set-cookie")).toContain("Max-Age=2592000");
    clock.advance(2 * 60_000);
    const added = await ADD(items({ slug: "sacuwin-100", qty: 1 }, cookie));
    expect(added.headers.get("set-cookie")).toContain("Max-Age=2592000");
  });
});

describe("logging", () => {
  it("a 500 whose message holds a slug and a phone number logs only the error name", async () => {
    const { cookie } = await signedIn({ phone: "+919876500002" });
    await ADD(items({ slug: "sacuwin-100", qty: 1 }, cookie));
    const spy = vi
      .spyOn(Collection.prototype, "updateOne")
      .mockRejectedValue(new TypeError("write failed for sacuwin-100 and +919876500002"));
    const res = await ADD(items({ slug: "sacuwin-100", qty: 1 }, cookie));
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(await body(res)).toEqual({ error: "internal_error" });
    expect(errors.mock.calls.at(-1)).toEqual(["route error", "TypeError"]);
    expect(JSON.stringify(errors.mock.calls)).not.toMatch(/sacuwin|9876500002/);
  });

  it("never puts a slug, phone or cookie into console.error", async () => {
    const { cookie } = await signedIn({ phone: "+919876500001" });
    await ADD(items({ slug: "nope", qty: 1 }, cookie));
    await ADD(items("not json", cookie));
    await ADD(items({ slug: "sacuwin-100", qty: 1 }, cookie, { contentType: "text/plain" }));
    const logged = JSON.stringify(errors.mock.calls);
    for (const needle of ["nope", "sacuwin", "9876500001", cookie.split("=")[1]!]) {
      expect(logged).not.toContain(needle);
    }
  });
});
