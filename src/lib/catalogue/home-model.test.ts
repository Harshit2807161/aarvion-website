import { describe, expect, it } from "vitest";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { BENTO_LAYOUT, bentoTiles, homeModel, tileList } from "./home-model";

const products = publicCatalogue();
const model = homeModel(products, CATEGORY_LIST);
const group = (slug: string) => model.groups.find((g) => g.category.slug === slug)!.products;

describe("homeModel", () => {
  it("groups the live categories that have products, in sortOrder", () => {
    expect(model.groups.map((g) => g.category.slug)).toEqual([
      "cardiology",
      "diabetology",
      "ophthalmology",
      "respiratory",
    ]);
  });

  it("counts every product and knows they all need a prescription", () => {
    expect(model.total).toBe(11);
    expect(model.allRx).toBe(true);
  });

  it("is not all-Rx when one product needs no prescription", () => {
    const otc = products.map((p, i) => (i === 0 ? { ...p, rxRequired: false } : p));
    expect(homeModel(otc, CATEGORY_LIST).allRx).toBe(false);
  });

  it("lists the coming-soon categories by name, hidden ones left out", () => {
    expect(model.comingSoon.map((c) => c.name)).toEqual([
      "Digestive care",
      "Bone and joint care",
      "Urinary care",
    ]);
  });

  it("drops a live category that has no products", () => {
    const m = homeModel(
      products.filter((p) => p.category !== "respiratory"),
      CATEGORY_LIST,
    );
    expect(m.groups.map((g) => g.category.slug)).not.toContain("respiratory");
  });
});

describe("tileList", () => {
  it("collapses a strength family and keeps hyphenated names whole", () => {
    expect(tileList(group("cardiology"))).toBe("Sacuwin 50, 100 and 200, Bemptor-180, Bemptor-R40");
  });

  it("strips the Eye Drops suffix", () => {
    expect(tileList(group("ophthalmology"))).toBe("Hyloage, Sysnet Ultra, Caftop, Oloage-KT");
  });

  it("names a single product whole", () => {
    expect(tileList(group("diabetology"))).toBe("Vildage-M 50/500");
    expect(tileList(group("respiratory"))).toBe("Mucohelp");
  });
});

describe("bentoTiles", () => {
  it("orders the tiles by BENTO_LAYOUT", () => {
    const tiles = bentoTiles(model);
    expect(tiles.map((t) => t.category.slug)).toEqual([
      "cardiology",
      "ophthalmology",
      "diabetology",
      "respiratory",
    ]);
    expect(tiles.map((t) => t.tile)).toEqual(["tile-cardio", "tile-eye", "tile-diab", "tile-resp"]);
  });

  it("takes the art in layout order", () => {
    const tiles = bentoTiles(model);
    expect(tiles[0]!.art.map((p) => p.slug)).toEqual(BENTO_LAYOUT.cardiology.art);
    expect(tiles[1]!.art.map((p) => p.slug)).toEqual(["sysnet-ultra", "oloage-kt", "caftop"]);
  });

  it("skips art slugs that are not in the group", () => {
    const m = homeModel(
      products.filter((p) => p.slug !== "sacuwin-200"),
      CATEGORY_LIST,
    );
    expect(bentoTiles(m)[0]!.art.map((p) => p.slug)).toEqual(["bemptor-r40", "sacuwin-100"]);
  });

  it("puts a live category the layout does not know last, as a diabetes-style tile", () => {
    const extraCat = {
      slug: "urology",
      name: "Urinary care",
      status: "live",
      sortOrder: 9,
    } as const;
    const extra = { ...products[0]!, slug: "x", name: "X", category: "urology" } as const;
    const m = homeModel(
      [...products, extra],
      [...CATEGORY_LIST.filter((c) => c.slug !== "urology"), extraCat],
    );
    const tiles = bentoTiles(m);
    expect(tiles.at(-1)!.category.slug).toBe("urology");
    expect(tiles.at(-1)!.tile).toBe("tile-diab");
    expect(tiles.at(-1)!.art).toEqual([]);
  });
});
