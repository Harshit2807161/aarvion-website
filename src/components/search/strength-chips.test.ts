import { describe, expect, it } from "vitest";
import { strengthChips } from "./strength-chips";

const v = (variantLabel: string | null) => ({ variantLabel });

describe("strengthChips", () => {
  it("lists strengths in variant order, once each", () => {
    expect(strengthChips([v("50"), v("100"), v("200"), v("100")])).toEqual(["50", "100", "200"]);
  });
  it("splits combined labels and drops what the API would refuse", () => {
    expect(strengthChips([v("50/500"), v("1234567"), v(null)])).toEqual(["50", "500"]);
  });
  it("is empty for an empty family", () => {
    expect(strengthChips([])).toEqual([]);
  });
});
