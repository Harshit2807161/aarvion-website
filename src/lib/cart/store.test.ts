import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_GUEST_STORAGE_KEY, CART_LIMITS, CART_UI_STORAGE_KEY, cartCount } from "./cart";
import { cartStore } from "./store";

const inc = (slug: string) => ({ type: "inc", slug }) as const;
const dec = (slug: string) => ({ type: "dec", slug }) as const;
const set = (slug: string, qty: number) => ({ type: "set", slug, qty }) as const;

const stored = () => JSON.parse(sessionStorage.getItem(CART_GUEST_STORAGE_KEY)!);
const seed = (lines: { slug: string; qty: number }[]) =>
  sessionStorage.setItem(CART_GUEST_STORAGE_KEY, JSON.stringify({ lines }));

beforeEach(() => {
  // The unit project runs in node: give the store an in-memory sessionStorage.
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  });
  cartStore.reset();
});
afterEach(() => vi.unstubAllGlobals());

describe("guest mode", () => {
  it("returns the same object from getSnapshot until a change (no useSyncExternalStore loop)", () => {
    expect(cartStore.getSnapshot()).toBe(cartStore.getSnapshot());
    cartStore.dispatch(inc("a"));
    const after = cartStore.getSnapshot();
    expect(after).toEqual({ a: 1 });
    expect(cartStore.getSnapshot()).toBe(after);
    cartStore.dispatch(dec("zzz"));
    expect(cartStore.getSnapshot()).toBe(after);
  });

  it("gives the server a frozen empty cart", () => {
    expect(cartStore.getServerSnapshot()).toEqual({});
    expect(Object.isFrozen(cartStore.getServerSnapshot())).toBe(true);
  });

  it("writes the v1 shape and removes the old v0 key", () => {
    sessionStorage.setItem(CART_UI_STORAGE_KEY, JSON.stringify({ old: 3 }));
    cartStore.dispatch(inc("a"));
    cartStore.dispatch(set("b", 2));
    expect(stored()).toEqual({
      lines: [
        { slug: "a", qty: 1 },
        { slug: "b", qty: 2 },
      ],
    });
    expect(sessionStorage.getItem(CART_UI_STORAGE_KEY)).toBeNull();
  });

  it("reads v1 once and re-caps what it reads, without writing", () => {
    sessionStorage.setItem(CART_UI_STORAGE_KEY, JSON.stringify({ old: 3 }));
    seed([
      { slug: "neg", qty: -1 },
      { slug: "frac", qty: 1.5 },
      { slug: "a", qty: 10 },
      { slug: "a", qty: 1 },
      { slug: "b", qty: 10 },
      { slug: "c", qty: 5 },
    ] as never);
    const lines = cartStore.getSnapshot();
    expect(Object.entries(lines)).toEqual([
      ["a", 10],
      ["b", 10],
    ]);
    expect(cartCount(lines)).toBe(CART_LIMITS.perOrder);
    expect(sessionStorage.getItem(CART_UI_STORAGE_KEY)).not.toBeNull(); // a read never writes
    cartStore.forgetLegacy();
    expect(sessionStorage.getItem(CART_UI_STORAGE_KEY)).toBeNull();
  });

  it("survives malformed data and blocked storage", () => {
    sessionStorage.setItem(CART_GUEST_STORAGE_KEY, "{not json");
    expect(cartStore.getSnapshot()).toEqual({});
    cartStore.reset();
    sessionStorage.setItem(CART_GUEST_STORAGE_KEY, JSON.stringify({ lines: "x" }));
    expect(cartStore.getSnapshot()).toEqual({});
    cartStore.reset();
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("sessionStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(cartStore.getSnapshot()).toEqual({});
    expect(cartStore.dispatch(inc("a"))).toBeNull();
    expect(cartStore.getSnapshot()).toEqual({ a: 1 });
  });

  it("notifies subscribers only on a change, and returns the block reason", () => {
    let calls = 0;
    const off = cartStore.subscribe(() => calls++);
    cartStore.dispatch(inc("a"));
    cartStore.dispatch(dec("zzz"));
    off();
    cartStore.dispatch(inc("a"));
    expect(calls).toBe(1);
    for (let i = 0; i < 10; i++) cartStore.dispatch(inc("a"));
    expect(cartStore.dispatch(inc("a"))).toBe("product_limit");
  });

  it("reconcile drops unknown slugs so they free the 20-pack cap, and never touches an empty catalogue", () => {
    seed([
      { slug: "gone", qty: 10 },
      { slug: "a", qty: 10 },
    ]);
    expect(cartStore.dispatch(inc("b"))).toBe("order_limit");
    expect(cartStore.reconcile(new Set())).toBe(false);
    expect(cartStore.reconcile(new Set(["a", "b"]))).toBe(true);
    expect(cartStore.getSnapshot()).toEqual({ a: 10 });
    expect(stored()).toEqual({ lines: [{ slug: "a", qty: 10 }] });
    expect(cartStore.dispatch(inc("b"))).toBeNull();
    expect(cartStore.reconcile(new Set(["a", "b"]))).toBe(false);
  });
});
