import { describe, expect, it } from "vitest";
import { CART_COPY } from "./cart-copy";
import { CART_SENTENCES } from "./cart-sentences";

describe("CART_SENTENCES", () => {
  it("keeps the wording CartControl and the cart line speak", () => {
    expect(CART_SENTENCES.productLimit("Sacuwin 100")).toBe(
      "You can order up to 10 packs of Sacuwin 100.",
    );
    expect(CART_SENTENCES.orderLimit).toBe("An order can hold up to 20 packs.");
    expect(CART_SENTENCES.inCart("Sacuwin 100", 2)).toBe("Sacuwin 100: 2 in cart");
    expect(CART_SENTENCES.removed("Sacuwin 100")).toBe("Sacuwin 100 removed from cart");
  });

  it("is the one source: the cart line's copy reuses it rather than repeating it", () => {
    expect(CART_COPY.productLimit).toBe(CART_SENTENCES.productLimit);
    expect(CART_COPY.orderLimit).toBe(CART_SENTENCES.orderLimit);
    expect(CART_COPY.inCart).toBe(CART_SENTENCES.inCart);
    expect(CART_COPY.removed).toBe(CART_SENTENCES.removed);
  });
});
