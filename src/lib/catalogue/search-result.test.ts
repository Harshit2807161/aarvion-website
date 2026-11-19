import { describe, expect, it } from "vitest";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { pocketImage } from "./display";
import { toSearchResult } from "./search-result";

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
      image: pocketImage(p),
    });
  });

  it("carries no composition array, notes or MRP source", () => {
    const keys = Object.keys(toSearchResult(product("sacuwin-100")));
    expect(keys).not.toContain("composition");
    expect(keys).not.toContain("internalNotes");
    expect(keys).not.toContain("mrpSource");
  });
});
