import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { percentOff, sellingPricePaise } from "./pricing.ts";

describe("sellingPricePaise", () => {
  it("subtracts Rs 20 from the MRP", () => {
    expect(sellingPricePaise(28100)).toBe(26100);
    expect(sellingPricePaise(2100)).toBe(100);
    expect(sellingPricePaise(40400)).toBe(38400);
  });

  it.each([2099, 0, -2000, 28100.5, NaN, Infinity])("rejects %s", (bad) => {
    expect(() => sellingPricePaise(bad)).toThrow(RangeError);
  });

  it("prices every listed product at MRP - Rs 20", () => {
    const expected: Record<string, number> = {
      "sacuwin-50": 26100,
      "sacuwin-100": 38700,
      "sacuwin-200": 27000,
      "bemptor-180": 36000,
      "bemptor-r40": 61000,
      "vildage-m-50-500": 16500,
      hyloage: 40500,
      "sysnet-ultra": 39600,
      caftop: 24300,
      "oloage-kt": 18900,
      mucohelp: 18900,
    };
    const { products } = JSON.parse(readFileSync("data/products.json", "utf8")) as {
      products: { slug: string; mrpPaise: number }[];
    };
    expect(products).toHaveLength(11);
    for (const p of products) {
      expect(sellingPricePaise(p.mrpPaise), p.slug).toBe(expected[p.slug]);
    }
  });
});

describe("percentOff", () => {
  // The 11 catalogue MRPs from the v2 review; the tag never rounds up.
  it.each([
    [28100, 7],
    [40700, 4],
    [29000, 6],
    [38000, 5],
    [63000, 3],
    [18500, 10],
    [42500, 4],
    [41600, 4],
    [26300, 7],
    [20900, 9],
    [117900, 1],
  ])("MRP %i paise is %i%% off", (mrp, pct) => {
    expect(percentOff(mrp)).toBe(pct);
  });

  it("floors: 4.9% off shows 4%", () => {
    expect(percentOff(40800)).toBe(4);
  });

  it.each([2000, 2099, 0, -1, 28100.5, NaN, Infinity])(
    "rejects %s like sellingPricePaise",
    (bad) => {
      expect(() => percentOff(bad)).toThrow(RangeError);
    },
  );
});
