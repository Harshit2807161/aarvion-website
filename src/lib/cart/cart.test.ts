import { describe, expect, it } from "vitest";
import { CART_LIMITS, applyCart, cartCount, type CartLines } from "./cart";

const inc = (slug: string) => ({ type: "inc", slug }) as const;
const dec = (slug: string) => ({ type: "dec", slug }) as const;
const set = (slug: string, qty: number) => ({ type: "set", slug, qty }) as const;
const remove = (slug: string) => ({ type: "remove", slug }) as const;

describe("applyCart", () => {
  it("adds a first pack", () => {
    expect(applyCart({}, inc("a"))).toEqual({ lines: { a: 1 }, blocked: null });
  });

  it("blocks the 11th pack of one product and leaves the lines unchanged", () => {
    let lines: CartLines = {};
    for (let i = 0; i < CART_LIMITS.perProduct; i++) lines = applyCart(lines, inc("a")).lines;
    expect(lines).toEqual({ a: 10 });
    const next = applyCart(lines, inc("a"));
    expect(next.blocked).toBe("product_limit");
    expect(next.lines).toBe(lines);
  });

  it("blocks a new product when the order already holds 20 packs", () => {
    const lines = { a: 10, b: 10 };
    const next = applyCart(lines, inc("c"));
    expect(next.blocked).toBe("order_limit");
    expect(next.lines).toEqual(lines);
  });

  it("removes the line when the last pack goes", () => {
    expect(applyCart({ a: 1 }, dec("a"))).toEqual({ lines: {}, blocked: null });
  });

  it("ignores a dec on a slug that is not in the cart", () => {
    const lines = { a: 2 };
    expect(applyCart(lines, dec("zzz"))).toEqual({ lines, blocked: null });
  });

  it("treats slugs that match Object.prototype members as ordinary keys", () => {
    for (const slug of ["constructor", "toString", "__proto__"]) {
      const added = applyCart({}, inc(slug));
      expect(Object.entries(added.lines)).toEqual([[slug, 1]]);
      expect(Object.entries(applyCart(added.lines, dec(slug)).lines)).toEqual([]);
    }
  });

  it("never mutates its input", () => {
    const lines = Object.freeze({ a: 1 });
    expect(applyCart(lines, inc("a")).lines).toEqual({ a: 2 });
    expect(lines).toEqual({ a: 1 });
  });
});

describe("applyCart set and remove", () => {
  it("sets a quantity, appends an absent slug, and 0 or remove drops the line", () => {
    expect(applyCart({ a: 1 }, set("a", 5))).toEqual({ lines: { a: 5 }, blocked: null });
    expect(applyCart({ a: 1 }, set("b", 2)).lines).toEqual({ a: 1, b: 2 });
    expect(applyCart({ a: 1, b: 2 }, set("a", 0)).lines).toEqual({ b: 2 });
    expect(applyCart({ a: 1, b: 2 }, remove("b")).lines).toEqual({ a: 1 });
  });

  it("refuses a set past 20 packs and keeps the same object", () => {
    const lines = { a: 10, b: 5, c: 5 };
    const next = applyCart(lines, set("b", 10));
    expect(next.blocked).toBe("order_limit");
    expect(next.lines).toBe(lines);
  });

  it("ignores a quantity outside 0..10 and removing an absent slug", () => {
    const lines = { a: 1 };
    for (const qty of [-1, 11, 1.5, Number.NaN]) {
      expect(applyCart(lines, set("a", qty))).toEqual({ lines, blocked: null });
    }
    expect(applyCart(lines, remove("zzz")).lines).toBe(lines);
  });
});

describe("cartCount", () => {
  it("sums the packs", () => expect(cartCount({ a: 2, b: 3 })).toBe(5));
  it("is 0 for an empty cart", () => expect(cartCount({})).toBe(0));
});
