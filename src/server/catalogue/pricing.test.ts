import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cartTotals, percentOff, sellingPricePaise } from "./pricing.ts";

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

  it("handles the range edges: 95% at the smallest valid MRP, 1% at Rs 2,000, 0 above", () => {
    expect(percentOff(2100)).toBe(95);
    expect(percentOff(200000)).toBe(1);
    expect(percentOff(200001)).toBe(0);
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

describe("cartTotals", () => {
  it("sums packs, MRP, the Rs 20 per pack discount and the payable amount", () => {
    expect(
      cartTotals([
        { mrpPaise: 40700, qty: 2 },
        { mrpPaise: 26300, qty: 1 },
      ]),
    ).toEqual({
      packs: 3,
      mrpPaise: 107700,
      discountPaise: 6000,
      discountPerPackPaise: 2000,
      deliveryPaise: 0,
      payablePaise: 101700,
    });
  });

  it("payable is the sum of sellingPricePaise times qty", () => {
    const items = [
      { mrpPaise: 28100, qty: 4 },
      { mrpPaise: 2100, qty: 10 },
    ];
    expect(cartTotals(items).payablePaise).toBe(
      sellingPricePaise(28100) * 4 + sellingPricePaise(2100) * 10,
    );
  });

  it("the discount is always Rs 20 times the packs, and MRP minus discount is the payable", () => {
    const mrps = [2100, 2500, 28100, 40400, 99999, 200000, 250000];
    let seed = 12345; // fixed LCG, so a failure reproduces
    const next = (n: number) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
    for (let round = 0; round < 200; round++) {
      const items = Array.from({ length: next(6) }, () => ({
        mrpPaise: mrps[next(mrps.length)]!,
        qty: next(11),
      }));
      const t = cartTotals(items);
      expect(t.discountPaise).toBe(2000 * t.packs);
      expect(t.mrpPaise - t.discountPaise).toBe(t.payablePaise);
    }
  });

  it("an empty cart is all zeros, with the per-pack discount still stated", () => {
    expect(cartTotals([])).toEqual({
      packs: 0,
      mrpPaise: 0,
      discountPaise: 0,
      discountPerPackPaise: 2000,
      deliveryPaise: 0,
      payablePaise: 0,
    });
  });

  it("throws RangeError for an MRP that cannot carry a price", () => {
    expect(() => cartTotals([{ mrpPaise: 2099, qty: 1 }])).toThrow(RangeError);
  });

  it.each([-1, 1.5, Number.NaN])("throws RangeError for a quantity of %s", (qty) => {
    expect(() => cartTotals([{ mrpPaise: 40700, qty }])).toThrow(RangeError);
  });
});
