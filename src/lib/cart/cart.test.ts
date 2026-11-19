import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_LIMITS, CART_UI_STORAGE_KEY, applyCart, cartCount, type CartLines } from "./cart";
import { cartStore } from "./store";

const inc = (slug: string) => ({ type: "inc", slug }) as const;
const dec = (slug: string) => ({ type: "dec", slug }) as const;

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

describe("cartCount", () => {
  it("sums the packs", () => expect(cartCount({ a: 2, b: 3 })).toBe(5));
  it("is 0 for an empty cart", () => expect(cartCount({})).toBe(0));
});

describe("cartStore", () => {
  beforeEach(() => {
    // The unit project runs in node: give the store an in-memory sessionStorage.
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      clear: () => data.clear(),
    });
    cartStore.reset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("returns the same object from getSnapshot until a dispatch (no useSyncExternalStore loop)", () => {
    expect(cartStore.getSnapshot()).toBe(cartStore.getSnapshot());
    cartStore.dispatch(inc("a"));
    const after = cartStore.getSnapshot();
    expect(after).toEqual({ a: 1 });
    expect(cartStore.getSnapshot()).toBe(after);
  });

  it("keeps the same object when a dispatch changes nothing", () => {
    const before = cartStore.getSnapshot();
    cartStore.dispatch(dec("a"));
    expect(cartStore.getSnapshot()).toBe(before);
  });

  it("gives the server a frozen empty cart", () => {
    expect(cartStore.getServerSnapshot()).toEqual({});
    expect(Object.isFrozen(cartStore.getServerSnapshot())).toBe(true);
  });

  it("reads sessionStorage once and writes on dispatch", () => {
    sessionStorage.setItem(CART_UI_STORAGE_KEY, JSON.stringify({ a: 2 }));
    expect(cartStore.getSnapshot()).toEqual({ a: 2 });
    cartStore.dispatch(inc("a"));
    expect(JSON.parse(sessionStorage.getItem(CART_UI_STORAGE_KEY)!)).toEqual({ a: 3 });
  });

  it("re-caps stored data: negative and fractional values dropped, order total cut to 20", () => {
    sessionStorage.setItem(
      CART_UI_STORAGE_KEY,
      JSON.stringify({ neg: -1, frac: 1.5, a: 10, b: 10, c: 5 }),
    );
    const lines = cartStore.getSnapshot();
    expect(Object.entries(lines)).toEqual([
      ["a", 10],
      ["b", 10],
    ]);
    expect(cartCount(lines)).toBe(CART_LIMITS.perOrder);
  });

  it("drops malformed stored data and survives broken storage", () => {
    sessionStorage.setItem(CART_UI_STORAGE_KEY, JSON.stringify({ a: 99, b: "x", c: 0, d: 2 }));
    expect(cartStore.getSnapshot()).toEqual({ a: 10, d: 2 });
    cartStore.reset();
    sessionStorage.setItem(CART_UI_STORAGE_KEY, "{not json");
    expect(cartStore.getSnapshot()).toEqual({});
    cartStore.reset();
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(cartStore.getSnapshot()).toEqual({});
    expect(cartStore.dispatch(inc("a"))).toBeNull();
    expect(cartStore.getSnapshot()).toEqual({ a: 1 });
  });

  it("notifies subscribers only when the lines change", () => {
    let calls = 0;
    const off = cartStore.subscribe(() => calls++);
    cartStore.dispatch(inc("a"));
    cartStore.dispatch(dec("zzz"));
    off();
    cartStore.dispatch(inc("a"));
    expect(calls).toBe(1);
  });

  it("reconcile drops unknown slugs so they free the 20-pack cap", () => {
    sessionStorage.setItem(CART_UI_STORAGE_KEY, JSON.stringify({ gone: 10, a: 10 }));
    expect(cartStore.dispatch(inc("b"))).toBe("order_limit");
    let calls = 0;
    cartStore.subscribe(() => calls++);
    expect(cartStore.reconcile(new Set(["a", "b"]))).toBe(true);
    expect(cartStore.getSnapshot()).toEqual({ a: 10 });
    expect(JSON.parse(sessionStorage.getItem(CART_UI_STORAGE_KEY)!)).toEqual({ a: 10 });
    expect(cartStore.dispatch(inc("b"))).toBeNull();
    cartStore.reconcile(new Set(["a", "b"]));
    expect(calls).toBe(2);
  });

  it("reconcile with an empty catalogue keeps the cart", () => {
    sessionStorage.setItem(CART_UI_STORAGE_KEY, JSON.stringify({ a: 2 }));
    expect(cartStore.reconcile(new Set())).toBe(false);
    expect(cartStore.getSnapshot()).toEqual({ a: 2 });
  });

  it("returns the block reason from dispatch", () => {
    for (let i = 0; i < 10; i++) cartStore.dispatch(inc("a"));
    expect(cartStore.dispatch(inc("a"))).toBe("product_limit");
  });
});
