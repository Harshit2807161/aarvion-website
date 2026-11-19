import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/products/route";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION } from "@/server/catalogue/collections";
import { seedCatalogue } from "@/server/catalogue/seed";
import { getDb } from "@/server/db/client";
import { resetDepsForTests } from "@/server/deps";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { catalogueDocs } from "../helpers/catalogue";
import { installClock } from "../helpers/clock";
import { TEST_ORIGIN } from "../helpers/http";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

async function seed() {
  const db = await getDb();
  await db.collection(PRODUCTS_COLLECTION).deleteMany({});
  await db.collection(CATEGORIES_COLLECTION).deleteMany({});
  await seedCatalogue(db, { categories: CATEGORY_LIST, products: catalogueDocs() }, new Date());
}

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(async () => {
  resetDepsForTests();
  await stopMemoryReplSet();
});
beforeEach(async () => {
  resetDepsForTests();
  installClock("2026-11-17T04:30:00Z");
  await clearCollections(RATE_LIMITS_COLLECTION);
  await seed();
});

const search = (qs: string, ip = "203.0.113.10") =>
  GET(
    new Request(new URL(`/api/products?${qs}`, TEST_ORIGIN), {
      headers: { "x-real-ip": ip },
    }),
  );
type Hit = { slug: string } & Record<string, unknown>;
const hits = async (qs: string): Promise<Hit[]> =>
  ((await (await search(qs)).json()) as { results: Hit[] }).results;
const slugs = async (qs: string) => (await hits(qs)).map((h) => h.slug);

describe("GET /api/products", () => {
  it("matches in shelf order", async () => {
    expect(await slugs("q=sacu")).toEqual(["sacuwin-50", "sacuwin-100", "sacuwin-200"]);
    expect(await slugs("q=bempedoic")).toEqual(["bemptor-180", "bemptor-r40"]);
    expect(await slugs("q=hydrochloride")).toEqual(["vildage-m-50-500", "oloage-kt", "mucohelp"]);
  });

  it("filters by strength, alone or with a query", async () => {
    expect(await slugs("strength=50")).toEqual(["sacuwin-50", "vildage-m-50-500"]);
    expect(await slugs("q=sacu&strength=200")).toEqual(["sacuwin-200"]);
  });

  it("is no-store, prices every hit at MRP minus 20 rupees and leaks no internals", async () => {
    const res = await search("q=sacu");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { results } = (await res.json()) as { results: Record<string, unknown>[] };
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.pricePaise).toBe((r.mrpPaise as number) - 2000);
      for (const k of ["internalNotes", "mrpSource", "composition"])
        expect(r).not.toHaveProperty(k);
    }
  });

  it("returns nothing for an empty or punctuation-only query", async () => {
    expect(await hits("q=")).toEqual([]);
    expect(await hits("")).toEqual([]);
    expect(await hits("q=.*")).toEqual([]);
  });

  it("caps the query at 64 characters", async () => {
    const long = await search(`q=${"a".repeat(65)}`);
    expect(long.status).toBe(400);
    expect((await long.json()).error).toBe("query_too_long");
    expect((await search(`q=${"a".repeat(64)}`)).status).toBe(200);
  });

  it("rejects a non-numeric strength", async () => {
    const res = await search("strength=5a");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_strength");
  });

  it("limits to 60 a minute per IP", async () => {
    for (let i = 0; i < 60; i++) expect((await search("q=sacu", "203.0.113.20")).status).toBe(200);
    const res = await search("q=sacu", "203.0.113.20");
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await search("q=sacu", "203.0.113.21")).status).toBe(200);
  });

  it("drops an inactive product", async () => {
    const db = await getDb();
    await db
      .collection(PRODUCTS_COLLECTION)
      .updateOne({ slug: "sacuwin-50" }, { $set: { active: false } });
    expect(await slugs("q=sacu")).toEqual(["sacuwin-100", "sacuwin-200"]);
  });
});
