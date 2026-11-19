import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/dev/catalogue/revalidate/route";
import {
  getCachedCategories,
  getCachedCategory,
  getCachedFamily,
  getCachedProduct,
  getCachedProducts,
} from "@/lib/catalogue/cached";
import { assertCatalogue, CatalogueEmptyError } from "@/lib/catalogue/errors";
import { revalidateCatalogue } from "@/lib/catalogue/revalidate";
import { CATALOGUE_TAG, categoryTag, familyTag, productTag } from "@/lib/catalogue/tags";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION } from "@/server/catalogue/collections";
import { seedCatalogue } from "@/server/catalogue/seed";
import { getDb } from "@/server/db/client";
import { resetEnvForTests } from "@/server/env";
import { catalogueDocs, publicCatalogue } from "../helpers/catalogue";
import { jsonPost } from "../helpers/http";
import { startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";
import { nextCache } from "../helpers/next-mocks";

beforeAll(async () => {
  await startMemoryReplSet();
  const db = await getDb();
  await db.collection(PRODUCTS_COLLECTION).deleteMany({});
  await db.collection(CATEGORIES_COLLECTION).deleteMany({});
  await seedCatalogue(db, { categories: CATEGORY_LIST, products: catalogueDocs() }, new Date());
}, 120_000);
afterAll(stopMemoryReplSet);
beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "");
  resetEnvForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvForTests();
});

const slugs = (ps: { slug: string }[]) => ps.map((p) => p.slug);
const withoutId = <T extends { id: string }>(ps: T[]) => ps.map((p) => ({ ...p, id: undefined }));

/** Each cached read sets the hours lifetime once and tags the whole catalogue. */
function expectCached(...tags: string[]) {
  expect(nextCache.cacheLife.mock.calls).toEqual([["hours"]]);
  expect(nextCache.cacheTag.mock.calls).toEqual([[CATALOGUE_TAG, ...tags]]);
  nextCache.cacheLife.mockClear();
  nextCache.cacheTag.mockClear();
}

describe("cached catalogue reads", () => {
  it("return the seeded catalogue, in shelf order", async () => {
    const products = await getCachedProducts();
    expectCached();
    expect(withoutId(products)).toEqual(withoutId(publicCatalogue()));
    expect(slugs(products)).toEqual([
      "sacuwin-50",
      "sacuwin-100",
      "sacuwin-200",
      "bemptor-180",
      "bemptor-r40",
      "vildage-m-50-500",
      "hyloage",
      "sysnet-ultra",
      "caftop",
      "oloage-kt",
      "mucohelp",
    ]);
  });

  it("return categories, a category, a product and a family with their tags", async () => {
    expect((await getCachedCategories()).map((c) => c.name)).toEqual([
      "Heart care",
      "Diabetes care",
      "Eye care",
      "Respiratory care",
      "Digestive care",
      "Bone and joint care",
      "Urinary care",
    ]);
    expectCached();
    expect((await getCachedCategory("cardiology"))?.name).toBe("Heart care");
    expectCached(categoryTag("cardiology"));
    expect((await getCachedProduct("sacuwin-100"))?.pricePaise).toBe(38700);
    expectCached(productTag("sacuwin-100"));
    expect(slugs(await getCachedFamily("sacuwin"))).toEqual([
      "sacuwin-50",
      "sacuwin-100",
      "sacuwin-200",
    ]);
    expectCached(familyTag("sacuwin"));
  });

  it("return null or nothing for unknown and hidden slugs", async () => {
    expect(await getCachedCategory("pain-management")).toBeNull();
    expect(await getCachedProduct("nope")).toBeNull();
    expect(await getCachedFamily("Bad Slug")).toEqual([]);
  });

  it("use distinct, namespaced tags", () => {
    const tags = [CATALOGUE_TAG, productTag("x"), familyTag("x"), categoryTag("x")];
    expect(CATALOGUE_TAG).toBe("catalogue");
    expect(new Set(tags).size).toBe(4);
  });
});

describe("revalidateCatalogue", () => {
  it("expires the catalogue tag immediately", () => {
    revalidateCatalogue();
    expect(nextCache.revalidateTag.mock.calls).toEqual([["catalogue", { expire: 0 }]]);
  });
});

describe("POST /dev/catalogue/revalidate", () => {
  const req = (origin?: string | null) => jsonPost("/dev/catalogue/revalidate", {}, { origin });

  it("revalidates and answers 204 for a same-origin request", async () => {
    const res = await POST(req());
    expect(res.status).toBe(204);
    expect(nextCache.revalidateTag.mock.calls).toEqual([["catalogue", { expire: 0 }]]);
  });

  it("403s without an Origin", async () => {
    const res = await POST(req(null));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "bad_origin" });
    expect(nextCache.revalidateTag).not.toHaveBeenCalled();
  });

  it("404s (Next notFound) on VERCEL_ENV=production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    resetEnvForTests();
    await expect(POST(req())).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(nextCache.revalidateTag).not.toHaveBeenCalled();
  });
});

describe("assertCatalogue", () => {
  it("throws CatalogueEmptyError for an empty catalogue, naming the database and the fix", () => {
    expect(() => assertCatalogue([])).toThrow(CatalogueEmptyError);
    expect(() => assertCatalogue([])).toThrow(/MONGODB_DB/);
    expect(() => assertCatalogue([])).toThrow(/pnpm seed/);
    expect(new CatalogueEmptyError().name).toBe("CatalogueEmptyError");
  });

  it("returns a non-empty catalogue unchanged", () => {
    const items = [{ slug: "a" }];
    expect(assertCatalogue(items)).toBe(items);
  });
});
