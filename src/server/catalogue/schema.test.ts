import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORY_LIST } from "./categories.ts";
import { CatalogueJson, Product, ProductJson } from "./schema.ts";

const raw = JSON.parse(readFileSync("data/products.json", "utf8"));
const sacuwin = () =>
  structuredClone(raw.products.find((p: { slug: string }) => p.slug === "sacuwin-50"));

describe("CatalogueJson", () => {
  it("parses data/products.json", () => {
    const c = CatalogueJson.parse(raw);
    expect(c.products).toHaveLength(11);
    expect(new Set(c.products.map((p) => p.slug)).size).toBe(11);
    expect(new Set(c.products.map((p) => p.category))).toEqual(
      new Set(["cardiology", "diabetology", "ophthalmology", "respiratory"]),
    );
  });

  it("rejects duplicate slugs", () => {
    const dup = { ...raw, products: [raw.products[0], raw.products[0]] };
    expect(CatalogueJson.safeParse(dup).success).toBe(false);
  });
});

describe("ProductJson", () => {
  it("accepts the sacuwin-50 entry and a null MRP", () => {
    expect(ProductJson.safeParse(sacuwin()).success).toBe(true);
    expect(ProductJson.safeParse({ ...sacuwin(), mrpPaise: null }).success).toBe(true);
  });

  it.each([
    ["mrp below minimum", { mrpPaise: 2099 }],
    ["extra key", { price: 26100 }],
    ["hero not in images", { heroImage: "assets/products/original/nope.webp" }],
    ["H without rx", { schedule: "H", rxRequired: false }],
    ["bad slug", { slug: "Sacuwin 50" }],
    ["unknown category", { category: "dermatology" }],
  ])("rejects %s", (_n, patch) => {
    expect(ProductJson.safeParse({ ...sacuwin(), ...patch }).success).toBe(false);
  });
});

describe("Product", () => {
  const doc = () => ({
    slug: "sacuwin-50",
    name: "Sacuwin 50",
    familySlug: "sacuwin",
    variantLabel: "50",
    category: "cardiology",
    composition: [{ ingredient: "Sacubitril", strength: "50 mg" }],
    dosageForm: "Tablet",
    packLabel: "Strip of 10 tablets",
    mrpPaise: 28100,
    mrpSource: "admin",
    schedule: "H",
    rxRequired: true,
    manufacturer: null,
    marketer: "Aarvion Pharmaceuticals",
    images: [{ src: "/products/sacuwin-50/0123abcd.webp", width: 1000, height: 1000, alt: "x" }],
    cutout: null,
    imageSource: "aarvion",
    active: true,
    sortOrder: 6,
    internalNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("accepts a valid document", () => {
    expect(Product.safeParse(doc()).success).toBe(true);
  });

  it("rejects a non-hashed image src", () => {
    const d = doc();
    d.images[0]!.src = "/assets/x.webp";
    expect(Product.safeParse(d).success).toBe(false);
  });

  it("rejects H without rx", () => {
    expect(Product.safeParse({ ...doc(), rxRequired: false }).success).toBe(false);
  });
});

describe("CATEGORY_LIST", () => {
  it("matches the spec table", () => {
    expect(CATEGORY_LIST).toEqual([
      { slug: "cardiology", name: "Cardiology", status: "live", sortOrder: 1 },
      { slug: "diabetology", name: "Diabetology", status: "live", sortOrder: 2 },
      { slug: "ophthalmology", name: "Eye care", status: "live", sortOrder: 3 },
      { slug: "respiratory", name: "Respiratory", status: "live", sortOrder: 4 },
      { slug: "gastroenterology", name: "Gastroenterology", status: "coming_soon", sortOrder: 5 },
      { slug: "orthopaedics", name: "Orthopaedics", status: "coming_soon", sortOrder: 6 },
      { slug: "urology", name: "Urology", status: "coming_soon", sortOrder: 7 },
      { slug: "pain-management", name: "Pain Management", status: "hidden", sortOrder: 8 },
    ]);
  });

  it("groups slugs by status", () => {
    const by = (s: string) => CATEGORY_LIST.filter((c) => c.status === s).map((c) => c.slug);
    expect(by("live")).toEqual(["cardiology", "diabetology", "ophthalmology", "respiratory"]);
    expect(by("coming_soon")).toEqual(["gastroenterology", "orthopaedics", "urology"]);
    expect(by("hidden")).toEqual(["pain-management"]);
  });
});
