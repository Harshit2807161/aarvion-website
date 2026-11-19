import { describe, expect, it } from "vitest";
import { catalogueCategories, publicCatalogue } from "../../../tests/helpers/catalogue";
import { compareVariants, orderForShelf } from "./order.ts";

const slugs = (ps: { slug: string }[]) => ps.map((p) => p.slug);
const family = (familySlug: string) =>
  publicCatalogue()
    .filter((p) => p.familySlug === familySlug)
    .reverse();

const SHELF = [
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
];

describe("compareVariants", () => {
  it("orders by the leading number of the variant label", () => {
    expect(slugs(family("sacuwin").sort(compareVariants))).toEqual([
      "sacuwin-50",
      "sacuwin-100",
      "sacuwin-200",
    ]);
    expect(slugs(family("bemptor").sort(compareVariants))).toEqual(["bemptor-180", "bemptor-r40"]);
  });

  it("puts NaN and null labels last, then orders by name", () => {
    const ps = [
      { variantLabel: null, name: "B" },
      { variantLabel: "R40", name: "A" },
      { variantLabel: "10", name: "Z" },
    ];
    expect(ps.sort(compareVariants).map((p) => p.name)).toEqual(["Z", "A", "B"]);
  });
});

describe("orderForShelf", () => {
  const shuffled = () => publicCatalogue().reverse();

  it("leads Heart care with the Sacuwin family, then Bemptor in variant order", () => {
    const cardio = orderForShelf(shuffled(), catalogueCategories()).filter(
      (p) => p.category === "cardiology",
    );
    expect(slugs(cardio)).toEqual([
      "sacuwin-50",
      "sacuwin-100",
      "sacuwin-200",
      "bemptor-180",
      "bemptor-r40",
    ]);
  });

  it("orders the whole shelf by category, then family, then variant", () => {
    const input = shuffled();
    const before = slugs(input);
    expect(slugs(orderForShelf(input, catalogueCategories()))).toEqual(SHELF);
    expect(slugs(input)).toEqual(before);
    expect(slugs(publicCatalogue())).toEqual(SHELF);
  });

  it("ranks a family by its lowest sortOrder", () => {
    const ps = shuffled().map((p) => (p.slug === "bemptor-r40" ? { ...p, sortOrder: -1 } : p));
    expect(slugs(orderForShelf(ps, catalogueCategories())).slice(0, 5)).toEqual([
      "bemptor-180",
      "bemptor-r40",
      "sacuwin-50",
      "sacuwin-100",
      "sacuwin-200",
    ]);
  });

  it("ranks categories by their sortOrder", () => {
    const categories = catalogueCategories().map((c) =>
      c.slug === "respiratory" ? { ...c, sortOrder: 0 } : c,
    );
    expect(slugs(orderForShelf(shuffled(), categories))[0]).toBe("mucohelp");
  });
});
