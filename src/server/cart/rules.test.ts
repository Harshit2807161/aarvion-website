import { describe, expect, it } from "vitest";
import {
  CART_LIMITS,
  addLine,
  capLines,
  cartPacks,
  mergeLines,
  removeLine,
  setLineQty,
  type CartLine,
} from "./rules";

const L = (slug: string, qty: number): CartLine => ({ slug, qty });
const packs = (lines: readonly CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);

describe("CART_LIMITS and cartPacks", () => {
  it("are 10 per product and 20 per order", () => {
    expect(CART_LIMITS).toEqual({ perProduct: 10, perOrder: 20 });
  });
  it("cartPacks sums the quantities", () => {
    expect(cartPacks([])).toBe(0);
    expect(cartPacks([L("a", 2), L("b", 3)])).toBe(5);
  });
});

describe("addLine", () => {
  it("appends a new slug", () => {
    expect(addLine([], "a")).toEqual({ lines: [L("a", 1)], blocked: null });
  });
  it("adds to an existing line, keeping order, without mutating", () => {
    const lines = [L("a", 1), L("b", 2)];
    const next = addLine(lines, "a", 3);
    expect(next).toEqual({ lines: [L("a", 4), L("b", 2)], blocked: null });
    expect(lines).toEqual([L("a", 1), L("b", 2)]);
  });
  it("refuses past 10 of one product and returns the same array", () => {
    const lines = [L("a", 9)];
    const next = addLine(lines, "a", 3);
    expect(next.blocked).toBe("product_limit");
    expect(next.lines).toBe(lines);
  });
  it("allows exactly 10 of one product", () => {
    expect(addLine([L("a", 9)], "a").lines).toEqual([L("a", 10)]);
  });
  it("allows landing exactly on 20 packs in the order", () => {
    expect(addLine([L("a", 10), L("b", 9)], "b")).toEqual({
      lines: [L("a", 10), L("b", 10)],
      blocked: null,
    });
  });
  it("refuses past 20 packs in the order and returns the same array", () => {
    const lines = [L("a", 10), L("b", 10)];
    const next = addLine(lines, "c");
    expect(next.blocked).toBe("order_limit");
    expect(next.lines).toBe(lines);
  });
  it("checks the product limit before the order limit", () => {
    expect(addLine([L("a", 10), L("b", 10)], "a").blocked).toBe("product_limit");
  });
  it("rejects an n outside the integers 1 to 10", () => {
    for (const n of [0, -1, 11, 1.5, Number.NaN]) {
      expect(() => addLine([], "a", n)).toThrow(RangeError);
    }
  });
});

describe("setLineQty", () => {
  it("0 removes the line", () => {
    expect(setLineQty([L("a", 2)], "a", 0)).toEqual({ lines: [], blocked: null });
  });
  it("sets, and appends an absent slug", () => {
    expect(setLineQty([L("a", 2)], "a", 5).lines).toEqual([L("a", 5)]);
    expect(setLineQty([L("a", 2)], "b", 3).lines).toEqual([L("a", 2), L("b", 3)]);
  });
  it("lowering never trips the order limit", () => {
    expect(setLineQty([L("a", 10), L("b", 10)], "b", 1).blocked).toBeNull();
  });
  it("refuses a set that takes the order past 20 packs, returning the same array", () => {
    const lines = [L("a", 10), L("b", 5), L("c", 5)];
    const next = setLineQty(lines, "b", 10);
    expect(next.blocked).toBe("order_limit");
    expect(next.lines).toBe(lines);
  });
  it("allows a set that lands exactly on 20 packs", () => {
    expect(setLineQty([L("a", 10), L("b", 9)], "b", 10)).toEqual({
      lines: [L("a", 10), L("b", 10)],
      blocked: null,
    });
  });
  it("an unchanged quantity, or removing an absent slug, returns the same array", () => {
    const lines = [L("a", 2)];
    expect(setLineQty(lines, "a", 2).lines).toBe(lines);
    expect(setLineQty(lines, "z", 0).lines).toBe(lines);
  });
  it("rejects a quantity outside the integers 0 to 10", () => {
    for (const q of [-1, 11, 2.5, Number.NaN]) {
      expect(() => setLineQty([], "a", q)).toThrow(RangeError);
    }
  });
});

describe("removeLine", () => {
  it("removes a line", () => {
    expect(removeLine([L("a", 2), L("b", 1)], "a")).toEqual({ lines: [L("b", 1)], blocked: null });
  });
  it("a missing slug returns the input and no block", () => {
    const lines = [L("a", 2)];
    const next = removeLine(lines, "z");
    expect(next.lines).toBe(lines);
    expect(next.blocked).toBeNull();
  });
});

describe("capLines", () => {
  it("keeps valid entries, first duplicate wins, clamps to 10, drops the rest", () => {
    const raw = [L("a", 12), L("a", 1), { b: "x" }, L("c", 10)];
    expect(capLines(raw)).toEqual({ lines: [L("a", 10), L("c", 10)], trimmed: false });
  });
  it("drops entries that are not { slug: string, qty: integer >= 1 }", () => {
    const raw = [
      null,
      7,
      "a",
      [],
      L("a", 0),
      L("a", -2),
      L("a", 1.5),
      { slug: 1, qty: 1 },
      { slug: "a", qty: "2" },
      { slug: "ok", qty: 2 },
    ];
    expect(capLines(raw)).toEqual({ lines: [L("ok", 2)], trimmed: false });
  });
  it("cuts at 20 packs from the end and says so", () => {
    const out = capLines([L("a", 10), L("b", 10), L("c", 10)]);
    expect(out).toEqual({ lines: [L("a", 10), L("b", 10)], trimmed: true });
  });
  it("shortens the line that crosses 20", () => {
    expect(capLines([L("a", 10), L("b", 7), L("c", 10)])).toEqual({
      lines: [L("a", 10), L("b", 7), L("c", 3)],
      trimmed: true,
    });
  });
  it("20 packs exactly is not trimmed", () => {
    expect(capLines([L("a", 10), L("b", 10)]).trimmed).toBe(false);
  });
  it("returns plain data with no extra fields", () => {
    expect(capLines([{ slug: "a", qty: 1, price: 5 }]).lines).toEqual([L("a", 1)]);
  });
});

describe("mergeLines", () => {
  it("takes the larger quantity per slug, server order first", () => {
    expect(mergeLines([L("a", 2)], [L("a", 1), L("b", 3)])).toEqual({
      lines: [L("a", 2), L("b", 3)],
      trimmed: false,
    });
    expect(mergeLines([L("a", 1)], [L("a", 4)]).lines).toEqual([L("a", 4)]);
  });
  it("caps the result at 20 packs and reports the trim", () => {
    const out = mergeLines([L("a", 10), L("b", 6)], [L("c", 10)]);
    expect(packs(out.lines)).toBe(20);
    expect(out.trimmed).toBe(true);
  });
  it("clamps a quantity above 10, first duplicate wins on each side, drops non-integers", () => {
    const out = mergeLines(
      [L("a", 3), L("a", 9), L("x", 2.5)],
      [L("a", 1), L("b", 15), L("b", 2), L("c", 0), L("d", 1.5)],
    );
    expect(out).toEqual({ lines: [L("a", 3), L("b", 10)], trimmed: false });
  });
  it.each([
    [[L("a", 2)], [L("a", 1), L("b", 3)]],
    [
      [L("a", 10), L("b", 5)],
      [L("c", 10), L("b", 9)],
    ],
    [[], [L("x", 10), L("y", 10), L("z", 10)]],
  ] as [CartLine[], CartLine[]][])(
    "is idempotent: merging the same guest cart twice equals once (%#)",
    (s, g) => {
      const once = mergeLines(s, g);
      expect(mergeLines(once.lines, g)).toEqual(once);
    },
  );
});

describe("a slug named __proto__", () => {
  it("is an ordinary line everywhere", () => {
    const added = addLine([], "__proto__", 2);
    expect(added.lines).toEqual([L("__proto__", 2)]);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(setLineQty(added.lines, "__proto__", 4).lines).toEqual([L("__proto__", 4)]);
    expect(removeLine(added.lines, "__proto__").lines).toEqual([]);
    expect(capLines(JSON.parse('[{"slug":"__proto__","qty":3}]')).lines).toEqual([
      L("__proto__", 3),
    ]);
    expect(mergeLines([L("__proto__", 1)], [L("__proto__", 2)]).lines).toEqual([L("__proto__", 2)]);
  });
});
