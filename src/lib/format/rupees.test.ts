import { describe, expect, it } from "vitest";
import { formatRupees } from "./rupees";

describe("formatRupees", () => {
  it.each([
    [38700, "₹387"],
    [117900, "₹1,179"],
    [10000000, "₹1,00,000"],
    [38750, "₹387.50"],
    [5, "₹0.05"],
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
