import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const files = [
  ...globSync("src/app/**/*.{ts,tsx}", { cwd: root }),
  ...globSync("src/components/**/*.{ts,tsx}", { cwd: root }),
].filter((f) => !/\.test\.tsx?$/.test(f));

/**
 * Every displayed price and % off derives from sellingPricePaise and percentOff in
 * src/server/catalogue/pricing.ts. UI code takes mrpPaise and renders it through
 * StampPrice, PriceInline or Rupees; it never reads a stored price or re-derives one.
 */
describe("price source", () => {
  it("scans the UI sources", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each([["pricePaise"], ["MRP_DISCOUNT_PAISE"], ["- 2000"]])(
    "no UI file contains %s",
    (needle) => {
      const hits = files.filter((f) => readFileSync(path.join(root, f), "utf8").includes(needle));
      expect(hits).toEqual([]);
    },
  );
});
