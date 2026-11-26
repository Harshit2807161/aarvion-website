import { describe, expect, it } from "vitest";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { BENTO_LAYOUT, bentoTiles, homeModel, railPlan, tileList } from "./home-model";

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

describe("railPlan", () => {
  const rails = railPlan(model);

  it("makes a rail of each category with several products, then one shared rail", () => {
    expect(rails.map((r) => r.id)).toEqual(["heart-care", "eye-care", "diabetes-care"]);
    expect(rails.map((r) => r.title)).toEqual([
      "Heart care",
      "Eye care",
      "Diabetes and respiratory care",
    ]);
    expect(rails.map((r) => r.products.length)).toEqual([5, 4, 2]);
  });

  it("cycles the rises and puts the aside and the extra anchors on the shared rail only", () => {
    expect(rails.map((r) => r.rise)).toEqual([80, 110, 90]);
    expect(rails.map((r) => r.aside)).toEqual([false, false, true]);
    expect(rails.map((r) => r.extraIds)).toEqual([[], [], ["respiratory-care"]]);
    expect(rails[2]!.categories.map((c) => c.slug)).toEqual(["diabetology", "respiratory"]);
  });

  it("starts the rises again after the third rail", () => {
    const many = {
      ...model,
      groups: [...model.groups, ...model.groups].map((g, i) => ({
        ...g,
        products: [...g.products, ...g.products].slice(0, 2 + (i % 2)),
      })),
    };
    expect(railPlan(many).map((r) => r.rise)).toEqual(
      [80, 110, 90, 80, 110, 90, 80, 110].slice(0, railPlan(many).length),
    );
  });

  it("names three or more single-product groups More medicines", () => {
    const three = homeModel(
      products.filter((p) => !["cardiology", "ophthalmology"].includes(p.category)),
      CATEGORY_LIST,
    );
    const solo = {
      ...three,
      groups: [
        ...three.groups,
        { category: model.groups[0]!.category, products: model.groups[0]!.products.slice(0, 1) },
      ],
    };
    const plan = railPlan(solo);
    expect(plan.map((r) => r.title)).toEqual(["More medicines"]);
    expect(plan[0]!.extraIds).toEqual(["respiratory-care", "heart-care"]);
  });

  it("gives a lone single-product group its own name and no shared rail when there are none", () => {
    const one = { ...model, groups: [model.groups[2]!] };
    expect(railPlan(one).map((r) => r.title)).toEqual(["Eye care"]);
    expect(railPlan(one)[0]!.aside).toBe(false);
    const lone = {
      ...model,
      groups: [{ ...model.groups[1]!, products: model.groups[1]!.products.slice(0, 1) }],
    };
    expect(railPlan(lone).map((r) => [r.title, r.aside])).toEqual([["Diabetes care", true]]);
  });
});
