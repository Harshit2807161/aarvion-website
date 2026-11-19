import { describe, expect, it } from "vitest";
import { formatRupees } from "./rupees";

describe("formatRupees", () => {
  it.each([
    [38700, "₹387"],
    [117900, "₹1,179"],
    [10000000, "₹1,00,000"],
    [38750, "₹387.50"],
    [5, "₹0.05"],
    [99, "₹0.99"],
    [100, "₹1"],
    [12345678, "₹1,23,456.78"],
    [1000000000, "₹1,00,00,000"],
    [Number.MAX_SAFE_INTEGER, "₹9,00,71,99,25,47,409.91"],
    [0, "₹0"],
  ])("formats %i paise as %s", (paise, text) => {
    expect(formatRupees(paise)).toBe(text);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2])(
    "rejects %s",
    (paise) => {
      expect(() => formatRupees(paise)).toThrow(RangeError);
    },
  );
});
