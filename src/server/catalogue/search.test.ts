import { describe, expect, it } from "vitest";
import { matchesTokens, normaliseSearchText, queryTokens } from "./search.ts";

describe("queryTokens", () => {
  it.each([
    ["  Sacu WIN ", ["sacu", "win"]],
    ["Bemptor-R40", ["bemptor", "r40"]],
    ["Valsártan", ["valsartan"]],
    [".*", []],
    ["^s$", ["s"]],
    ["a".repeat(100), ["a".repeat(64)]],
  ])("%j -> %j", (q, expected) => {
    expect(queryTokens(q)).toEqual(expected);
  });
});

describe("normaliseSearchText", () => {
  it("strips accents, lowercases and collapses punctuation", () => {
    expect(normaliseSearchText("  Valsártan / R-40 ")).toBe("valsartan r 40");
  });
});

describe("matchesTokens", () => {
  const sacuwin = {
    name: "Sacuwin 100",
    familySlug: "sacuwin",
    composition: [
      { ingredient: "Sacubitril", strength: "49 mg" },
      { ingredient: "Valsartan", strength: "51 mg" },
    ],
  };
  it("requires every token to be a substring of the space-free haystack", () => {
    expect(matchesTokens(sacuwin, ["sacuwin", "100"])).toBe(true);
    expect(matchesTokens(sacuwin, ["sacu", "valsartan"])).toBe(true);
    expect(matchesTokens(sacuwin, ["sacubitril", "valsartan"])).toBe(true);
    expect(matchesTokens(sacuwin, ["metformin"])).toBe(false);
    expect(matchesTokens(sacuwin, ["24"])).toBe(false);
  });
});
