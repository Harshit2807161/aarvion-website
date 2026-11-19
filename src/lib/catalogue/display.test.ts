import { describe, expect, it } from "vitest";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import {
  actives,
  categoryAnchor,
  countWord,
  fullComposition,
  packDisplay,
  plural,
  pocketImage,
  shortName,
  strengthTokens,
} from "./display";

const NB = " ";
const catalogue = publicCatalogue();
const product = (slug: string) => {
  const p = catalogue.find((x) => x.slug === slug);
  if (!p) throw new Error(`no ${slug} in the seed catalogue`);
  return p;
};

describe("fullComposition", () => {
  it("joins every ingredient with its strength, salt form and preservative included", () => {
    expect(fullComposition(product("sacuwin-50").composition)).toBe(
      "Sacubitril (as sodium) 24 mg + Valsartan 26 mg",
    );
    expect(fullComposition(product("hyloage").composition)).toBe(
      "Sodium Hyaluronate 0.1% w/v + Stabilized Oxychloro Complex (preservative) 0.005% w/v",
    );
  });
});

describe("actives", () => {
  it("drops the salt form and keeps each strength on one line", () => {
    expect(actives(product("sacuwin-50").composition)).toEqual([
      { name: "Sacubitril", strength: `24${NB}mg` },
      { name: "Valsartan", strength: `26${NB}mg` },
    ]);
  });

  it("drops the preservative", () => {
    expect(actives(product("hyloage").composition)).toEqual([
      { name: "Sodium Hyaluronate", strength: `0.1%${NB}w/v` },
    ]);
  });

  it("strips the bracketed salt form from a second active", () => {
    expect(actives(product("bemptor-r40").composition).map((a) => a.name)).toEqual([
      "Bempedoic Acid",
      "Rosuvastatin",
    ]);
  });

  it("never leaves a plain space inside a strength", () => {
    for (const p of catalogue) {
      for (const a of actives(p.composition)) expect(a.strength).not.toContain(" ");
    }
  });
});

describe("packDisplay", () => {
  it("names the bottle for eye drops and keeps a number with its unit", () => {
    expect(packDisplay(product("hyloage"))).toBe(`10${NB}ml bottle`);
    expect(packDisplay(product("sacuwin-50"))).toBe(`Strip of 14${NB}tablets`);
  });

  it("joins a number to a µ or % unit too", () => {
    expect(packDisplay({ packLabel: "Tube of 5 µg", dosageForm: "Gel" })).toBe(`Tube of 5${NB}µg`);
    expect(packDisplay({ packLabel: "1 % cream", dosageForm: "Cream" })).toBe(`1${NB}% cream`);
  });
});

describe("strengthTokens", () => {
  it("returns the runs of digits in a variant label", () => {
    expect(strengthTokens("R40")).toEqual(["40"]);
    expect(strengthTokens("50/500")).toEqual(["50", "500"]);
    expect(strengthTokens("180")).toEqual(["180"]);
  });

  it("returns nothing for a product without variants", () => {
    expect(strengthTokens(null)).toEqual([]);
    expect(strengthTokens("")).toEqual([]);
  });
});

describe("shortName", () => {
  it('strips a trailing " Eye Drops" and nothing else', () => {
    expect(shortName("Hyloage Eye Drops")).toBe("Hyloage");
    expect(shortName("Oloage-KT Eye Drops")).toBe("Oloage-KT");
    expect(shortName("Sacuwin 100")).toBe("Sacuwin 100");
  });
});

describe("plural and countWord", () => {
  it("counts a word", () => {
    expect(plural(1, "medicine")).toBe("1 medicine");
    expect(plural(5, "medicine")).toBe("5 medicines");
    expect(plural(0, "medicine")).toBe("0 medicines");
  });

  it("spells one to twenty, then falls back to digits", () => {
    expect(countWord(1)).toBe("One");
    expect(countWord(11)).toBe("Eleven");
    expect(countWord(20)).toBe("Twenty");
    expect(countWord(21)).toBe("21");
    expect(countWord(0)).toBe("0");
  });
});

describe("pocketImage", () => {
  it("prefers the cutout, else the first photo", () => {
    const p = product("sacuwin-100");
    expect(pocketImage(p)).toBe(p.cutout);
    expect(pocketImage({ ...p, cutout: null })).toBe(p.images[0]);
  });
});

describe("categoryAnchor", () => {
  it("turns a shopper category name into an anchor id", () => {
    expect(categoryAnchor("Heart care")).toBe("heart-care");
    expect(categoryAnchor("Respiratory care")).toBe("respiratory-care");
    expect(categoryAnchor("Bone and joint care")).toBe("bone-and-joint-care");
  });
});
