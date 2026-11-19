import { describe, expect, it } from "vitest";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { MAX_RESULTS, searchProducts, toSearchResult } from "./search-result";

const NB = "\u00a0";
const product = (slug: string) => {
  const p = publicCatalogue().find((x) => x.slug === slug);
  if (!p) throw new Error(`no ${slug} in the seed catalogue`);
  return p;
};

describe("toSearchResult", () => {
  it("keeps only what the search shows, with the selling price from the MRP", () => {
    const p = product("sacuwin-100");
    expect(toSearchResult(p)).toEqual({
      slug: "sacuwin-100",
      name: "Sacuwin 100",
      salt: "Sacubitril (as sodium) 49 mg + Valsartan 51 mg",
      pack: `Strip of 14${NB}tablets`,
      mrpPaise: 40700,
      pricePaise: 38700,
      image: p.cutout,
    });
  });

  it("carries no composition array, notes or MRP source", () => {
    const keys = Object.keys(toSearchResult(product("sacuwin-100")));
    expect(keys).not.toContain("composition");
    expect(keys).not.toContain("internalNotes");
    expect(keys).not.toContain("mrpSource");
  });
});

describe("searchProducts", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    ...product("sacuwin-100"),
    slug: `sacuwin-${i}`,
  }));

  it("returns at most 20 hits, first in the given order", () => {
    const hits = searchProducts(many, "sacu", null);
    expect(MAX_RESULTS).toBe(20);
    expect(hits).toHaveLength(20);
    expect(hits[0]!.slug).toBe("sacuwin-0");
    expect(hits[19]!.slug).toBe("sacuwin-19");
  });

  it("matches a strength as a whole number: 5 does not match 50", () => {
    const all = publicCatalogue();
    expect(searchProducts(all, "", "5")).toEqual([]);
    expect(searchProducts(all, "", "50").map((r) => r.slug)).toEqual([
      "sacuwin-50",
      "vildage-m-50-500",
    ]);
  });

  it("gives nothing for no query and no strength", () => {
    expect(searchProducts(many, " .* ", null)).toEqual([]);
  });
});
