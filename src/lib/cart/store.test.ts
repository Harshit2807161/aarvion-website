import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { CART_GUEST_STORAGE_KEY, CART_LIMITS, CART_UI_STORAGE_KEY, cartCount } from "./cart";
import { cartStore, type CartIssue } from "./store";

vi.mock("./api", () => ({
  getCart: vi.fn(),
  addItem: vi.fn(),
  setQty: vi.fn(),
  removeItem: vi.fn(),
  mergeCart: vi.fn(),
  quoteCart: vi.fn(),
}));
const m = vi.mocked(api);

const inc = (slug: string) => ({ type: "inc", slug }) as const;
const dec = (slug: string) => ({ type: "dec", slug }) as const;
const set = (slug: string, qty: number) => ({ type: "set", slug, qty }) as const;

/** A server view with these lines (only what the store reads: slug, qty, removed). */
const view = (lines: Record<string, number>, extra: Record<string, unknown> = {}) =>
  ({
    lines: Object.entries(lines).map(([slug, qty]) => ({ slug, qty })),
    totals: { packs: cartCount(lines) },
    removed: [],
    ...extra,
  }) as never;
const ok = (lines: Record<string, number>, extra: Record<string, unknown> = {}) =>
  Promise.resolve({ ok: true as const, view: view(lines, extra) });
const fail = (error: string) => Promise.resolve({ ok: false as const, error }) as never;
const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

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
  vi.useFakeTimers();
  vi.resetAllMocks();
  cartStore.reset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

describe("the guest view", () => {
  it("re-quotes a burst of changes once, 400 ms after the last, and keeps getView priced", async () => {
    m.quoteCart.mockImplementation(() => ok({ a: 2 }));
    cartStore.dispatch(inc("a"));
    await tick(300);
    cartStore.dispatch(inc("a"));
    expect(cartStore.isViewStale()).toBe(true);
    await tick(399);
    expect(m.quoteCart).not.toHaveBeenCalled();
    await tick(1);
    expect(m.quoteCart).toHaveBeenCalledTimes(1);
    expect(m.quoteCart).toHaveBeenCalledWith([{ slug: "a", qty: 2 }]);
    expect(cartStore.getView()?.totals.packs).toBe(2);
    expect(cartStore.isViewStale()).toBe(false);
  });

  it("clears the view and sends nothing for an empty cart", async () => {
    m.quoteCart.mockImplementation(() => ok({ a: 1 }));
    cartStore.dispatch(inc("a"));
    await tick(400);
    expect(cartStore.getView()).not.toBeNull();
    cartStore.dispatch(dec("a"));
    expect(cartStore.getView()).toBeNull();
    expect(cartStore.isViewStale()).toBe(false);
    await tick(5000);
    expect(m.quoteCart).toHaveBeenCalledTimes(1);
  });

  it("ignores a quote reply a newer change has superseded", async () => {
    let releaseFirst: () => void = () => {};
    m.quoteCart
      .mockImplementationOnce(
        () =>
          new Promise((r) => (releaseFirst = () => r({ ok: true, view: view({ a: 1 }) } as never))),
      )
      .mockImplementationOnce(() => ok({ a: 2 }));
    cartStore.dispatch(inc("a"));
    await tick(400); // first request in flight
    cartStore.dispatch(inc("a"));
    await tick(400);
    expect(cartStore.getView()?.totals.packs).toBe(2);
    releaseFirst();
    await tick(0);
    expect(cartStore.getView()?.totals.packs).toBe(2);
  });

  it("keeps the last good view, marks it stale, and retries with backoff after a failure", async () => {
    m.quoteCart.mockImplementationOnce(() => ok({ a: 1 }));
    cartStore.dispatch(inc("a"));
    await tick(400);
    m.quoteCart
      .mockImplementationOnce(() => fail("rate_limited"))
      .mockImplementationOnce(() => ok({ a: 2 }));
    cartStore.dispatch(inc("a"));
    await tick(400);
    expect(cartStore.getView()?.totals.packs).toBe(1); // the last good view, not dropped
    expect(cartStore.isViewStale()).toBe(true);
    await tick(999);
    expect(m.quoteCart).toHaveBeenCalledTimes(2);
    await tick(1);
    expect(m.quoteCart).toHaveBeenCalledTimes(3);
    expect(cartStore.getView()?.totals.packs).toBe(2);
    expect(cartStore.isViewStale()).toBe(false);
  });

  it("gives up after its retries and waits for the next change", async () => {
    m.quoteCart.mockImplementation(() => fail("network"));
    cartStore.dispatch(inc("a"));
    await tick(400 + 1000 + 3000 + 8000);
    expect(m.quoteCart).toHaveBeenCalledTimes(4);
    await tick(60_000);
    expect(m.quoteCart).toHaveBeenCalledTimes(4);
    expect(cartStore.isViewStale()).toBe(true);
  });

  it("drops a line the server says is no longer sold, and says so once", async () => {
    const issues: CartIssue[] = [];
    cartStore.onIssue((i) => issues.push(i));
    seed([
      { slug: "a", qty: 1 },
      { slug: "x", qty: 2 },
    ]);
    m.quoteCart.mockImplementation(() => ok({ a: 1 }, { removed: ["x"] }));
    cartStore.dispatch(inc("a"));
    await tick(400);
    expect(cartStore.getSnapshot()).toEqual({ a: 2 });
    expect(stored()).toEqual({ lines: [{ slug: "a", qty: 2 }] });
    expect(issues).toEqual([{ kind: "removed", slugs: ["x"] }]);
  });
});
