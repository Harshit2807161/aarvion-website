import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { CART_GUEST_STORAGE_KEY, CART_LIMITS, CART_UI_STORAGE_KEY, cartCount } from "./cart";
import { cartStore, resetCartStore, type CartIssue } from "./store";

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
/** Lets a lazily loaded chunk (the quoter) arrive, then advances the fake clock. */
const tick = async (ms: number) => {
  await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(ms);
};

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
  resetCartStore();
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
    resetCartStore();
    sessionStorage.setItem(CART_GUEST_STORAGE_KEY, JSON.stringify({ lines: "x" }));
    expect(cartStore.getSnapshot()).toEqual({});
    resetCartStore();
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

describe("the quoting code is a lazy chunk", () => {
  it("store.ts has no static import of it or of the api client, so an empty cart never loads either", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/^import (?!type)[^;]*from "\.\/(guest-quote|api)"/m);
    expect(src).toContain('import("./guest-quote")');
  });

  it("sends nothing for an empty cart", async () => {
    cartStore.dispatch(inc("a"));
    cartStore.dispatch(dec("a"));
    await tick(5000);
    expect(m.quoteCart).not.toHaveBeenCalled();
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

  it("a reply to a superseded quote never clears stale, even if the newer quote then fails", async () => {
    m.quoteCart.mockImplementationOnce(() => ok({ a: 1 }));
    cartStore.dispatch(inc("a"));
    await tick(400); // a good view of {a:1}
    let releaseOld: () => void = () => {};
    m.quoteCart.mockImplementationOnce(
      () => new Promise((r) => (releaseOld = () => r({ ok: true, view: view({ a: 2 }) } as never))),
    );
    cartStore.dispatch(inc("a"));
    await tick(400); // the quote for {a:2} is in flight
    m.quoteCart.mockImplementation(() => fail("network"));
    cartStore.dispatch(inc("a")); // {a:3}: supersedes it, though nothing is sent yet
    releaseOld();
    await tick(0);
    expect(cartStore.isViewStale()).toBe(true);
    expect(cartStore.getView()?.totals.packs).toBe(1);
    await tick(400); // the newer quote fails
    expect(cartStore.isViewStale()).toBe(true);
    expect(cartStore.getView()?.totals.packs).toBe(1);
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

describe("signIn", () => {
  it("merges the guest cart once, clears guest storage and switches to user mode", async () => {
    seed([{ slug: "a", qty: 1 }]);
    m.mergeCart.mockImplementation(() => ok({ a: 2, b: 1 }, { trimmed: true, removed: ["ghost"] }));
    const issues: CartIssue[] = [];
    cartStore.onIssue((i) => issues.push(i));
    const out = await cartStore.signIn();
    expect(m.mergeCart).toHaveBeenCalledTimes(1);
    expect(m.mergeCart).toHaveBeenCalledWith([{ slug: "a", qty: 1 }]);
    expect(m.getCart).not.toHaveBeenCalled();
    expect(out).toEqual({ trimmed: true, removed: ["ghost"] });
    expect(issues).toEqual([{ kind: "removed", slugs: ["ghost"] }, { kind: "trimmed" }]);
    expect(cartStore.getMode()).toBe("user");
    expect(cartStore.getSnapshot()).toEqual({ a: 2, b: 1 });
    expect(cartStore.getView()?.totals.packs).toBe(3);
    expect(sessionStorage.getItem(CART_GUEST_STORAGE_KEY)).toBeNull();
  });

  it("merges what the shopper has now, even with blocked storage", async () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("sessionStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
    cartStore.dispatch(inc("a"));
    m.mergeCart.mockImplementation(() => ok({ a: 1 }));
    await cartStore.signIn();
    expect(m.mergeCart).toHaveBeenCalledWith([{ slug: "a", qty: 1 }]);
  });

  it("just loads the server cart when there is no guest cart", async () => {
    m.getCart.mockImplementation(() => ok({ a: 3 }));
    expect(await cartStore.signIn()).toEqual({ trimmed: false, removed: [] });
    expect(m.mergeCart).not.toHaveBeenCalled();
    expect(cartStore.getSnapshot()).toEqual({ a: 3 });
  });

  it("a second call while the first is pending reuses its promise", async () => {
    seed([{ slug: "a", qty: 1 }]);
    let release: () => void = () => {};
    m.mergeCart.mockImplementation(
      () => new Promise((r) => (release = () => r({ ok: true, view: view({ a: 1 }) } as never))),
    );
    const first = cartStore.signIn();
    expect(cartStore.signIn()).toBe(first);
    await vi.dynamicImportSettled(); // the user-mode chunk loads, then the merge starts
    release();
    await first;
    expect(m.mergeCart).toHaveBeenCalledTimes(1);
  });

  it("a tap made while the user-mode chunk loads is merged, not lost", async () => {
    seed([{ slug: "a", qty: 1 }]);
    m.mergeCart.mockImplementation(() => ok({ a: 1, b: 1 }));
    const signing = cartStore.signIn(); // the chunk has not loaded yet
    cartStore.dispatch(inc("b"));
    await signing;
    expect(m.mergeCart).toHaveBeenCalledWith([
      { slug: "a", qty: 1 },
      { slug: "b", qty: 1 },
    ]);
    expect(cartStore.getSnapshot()).toEqual({ a: 1, b: 1 });
  });

  it("a change made while the merge is in flight survives it", async () => {
    seed([{ slug: "a", qty: 1 }]);
    let release: () => void = () => {};
    m.mergeCart.mockImplementation(
      () => new Promise((r) => (release = () => r({ ok: true, view: view({ a: 1 }) } as never))),
    );
    m.addItem.mockImplementation(() => ok({ a: 1, b: 1 }));
    const signing = cartStore.signIn();
    await vi.dynamicImportSettled(); // the merge request is now in flight
    cartStore.dispatch(inc("b"));
    release();
    await signing;
    expect(cartStore.getSnapshot()).toEqual({ a: 1, b: 1 });
    await tick(0);
    expect(m.addItem).toHaveBeenCalledWith("b", 1);
  });

  it("a guest page load does not pull the user-mode chunk in", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/^import (?!type)[^;]*from "\.\/user-mode"/m); // type-only imports are erased
    expect(src).toContain('import("./user-mode")');
    expect(src).not.toMatch(
      /import \* as api|import \{[^}]*(getCart|addItem|setQty|removeItem|mergeCart)/,
    );
  });

  it("a failed merge keeps the guest cart and says so; a 401 stays guest quietly", async () => {
    const issues: CartIssue[] = [];
    cartStore.onIssue((i) => issues.push(i));
    seed([{ slug: "a", qty: 1 }]);
    m.mergeCart.mockImplementation(() => fail("network"));
    await cartStore.signIn();
    expect(cartStore.getMode()).not.toBe("user");
    expect(stored()).toEqual({ lines: [{ slug: "a", qty: 1 }] });
    expect(issues).toEqual([{ kind: "sync_failed" }]);
    m.mergeCart.mockImplementation(() => fail("unauthenticated"));
    await cartStore.signIn();
    expect(cartStore.getMode()).not.toBe("user");
    expect(issues).toHaveLength(1);
  });

  it("toGuest(true) keeps the guest cart for a signed-out load", () => {
    seed([{ slug: "a", qty: 2 }]);
    cartStore.toGuest(true);
    expect(cartStore.getMode()).toBe("guest");
    expect(cartStore.getSnapshot()).toEqual({ a: 2 });
  });
  it("a tap the merged cart refuses is reported, not dropped silently", async () => {
    const issues: CartIssue[] = [];
    cartStore.onIssue((i) => issues.push(i));
    seed([{ slug: "a", qty: 1 }]);
    let release: () => void = () => {};
    m.mergeCart.mockImplementation(
      () =>
        new Promise(
          (r) => (release = () => r({ ok: true, view: view({ a: 10, b: 10 }) } as never)),
        ),
    );
    const signing = cartStore.signIn();
    await vi.dynamicImportSettled(); // the chunk is loaded and the merge is in flight
    cartStore.dispatch(inc("c"));
    release();
    await signing;
    expect(cartStore.getSnapshot()).toEqual({ a: 10, b: 10 });
    expect(issues).toEqual([{ kind: "refused", error: "order_limit" }]);
  });

  it("refresh does nothing when not signed in", async () => {
    cartStore.refresh();
    await tick(0);
    expect(m.getCart).not.toHaveBeenCalled();
  });

  it("toGuest(true) leaves a store that is already signed in alone", async () => {
    m.getCart.mockImplementation(() => ok({ a: 3 }));
    await cartStore.signIn();
    cartStore.toGuest(true);
    expect(cartStore.getMode()).toBe("user");
    expect(cartStore.getSnapshot()).toEqual({ a: 3 });
  });
});

describe("user mode", () => {
  beforeEach(async () => {
    m.getCart.mockImplementation(() => ok({ a: 1 }));
    await cartStore.signIn();
  });

  it("applies a change at once, sends a + as a relative add, then adopts the server's lines", async () => {
    m.addItem.mockImplementation(() => ok({ a: 2 }));
    cartStore.dispatch(inc("a"));
    expect(cartStore.getSnapshot()).toEqual({ a: 2 });
    await tick(0);
    expect(m.addItem).toHaveBeenCalledWith("a", 1);
    expect(m.setQty).not.toHaveBeenCalled();
    expect(cartStore.getSnapshot()).toEqual({ a: 2 });
    expect(sessionStorage.getItem(CART_GUEST_STORAGE_KEY)).toBeNull();
  });

  it("a + lands on the server's quantity, not this tab's cached one (another tab set 5)", async () => {
    const server: Record<string, number> = { a: 1 };
    m.addItem.mockImplementation(async (slug, n) => {
      server[slug] = (server[slug] ?? 0) + n;
      return { ok: true, view: view({ ...server }) } as never;
    });
    server.a = 5; // the other tab set 5; this tab still caches 1
    expect(cartStore.getSnapshot()).toEqual({ a: 1 });
    cartStore.dispatch(inc("a"));
    await tick(0);
    expect(m.addItem).toHaveBeenCalledWith("a", 1);
    expect(cartStore.getSnapshot()).toEqual({ a: 6 });
  });

  it("sends dec and set as a quantity and remove as a delete", async () => {
    m.setQty.mockImplementation(() => ok({}));
    m.removeItem.mockImplementation(() => ok({}));
    cartStore.dispatch(set("a", 4));
    cartStore.dispatch(dec("a"));
    cartStore.dispatch({ type: "remove", slug: "a" });
    await tick(0);
    expect(m.setQty.mock.calls).toEqual([
      ["a", 4],
      ["a", 3],
    ]);
    expect(m.removeItem).toHaveBeenCalledWith("a");
  });

  it("reverts to the server's lines and emits refused when the server says no", async () => {
    const issues: CartIssue[] = [];
    cartStore.onIssue((i) => issues.push(i));
    m.addItem.mockImplementation(
      () => Promise.resolve({ ok: false, error: "product_limit", view: view({ a: 10 }) }) as never,
    );
    cartStore.dispatch(inc("a"));
    await tick(0);
    expect(cartStore.getSnapshot()).toEqual({ a: 10 });
    expect(issues).toEqual([{ kind: "refused", error: "product_limit" }]);
  });

  it("reverts and emits sync_failed on a lost request", async () => {
    const issues: CartIssue[] = [];
    cartStore.onIssue((i) => issues.push(i));
    m.addItem.mockImplementation(() => fail("network"));
    cartStore.dispatch(inc("a"));
    expect(cartStore.getSnapshot()).toEqual({ a: 2 });
    await tick(0);
    expect(cartStore.getSnapshot()).toEqual({ a: 1 });
    expect(issues).toEqual([{ kind: "sync_failed" }]);
  });

  it("says once when the server's reply drops a product that is no longer sold", async () => {
    const issues: CartIssue[] = [];
    cartStore.onIssue((i) => issues.push(i));
    m.addItem.mockImplementation(() => ok({ a: 2 }, { removed: ["x"] }));
    cartStore.dispatch(inc("a"));
    await tick(0);
    expect(issues).toEqual([{ kind: "removed", slugs: ["x"] }]);
  });

  it("sends rapid changes in order with at most one in flight, and a stale reply never undoes a newer tap", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const order: number[] = [];
    let n = 0;
    m.addItem.mockImplementation(async () => {
      const qty = ++n + 1;
      order.push(qty);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
      return { ok: true, view: view({ a: qty }) } as never;
    });
    cartStore.dispatch(inc("a"));
    cartStore.dispatch(inc("a"));
    cartStore.dispatch(inc("a"));
    expect(cartStore.getSnapshot()).toEqual({ a: 4 });
    await tick(0);
    expect(order).toEqual([2, 3, 4]);
    expect(maxInFlight).toBe(1);
    expect(cartStore.getSnapshot()).toEqual({ a: 4 });
  });

  it("a 401 drops to guest mode with an empty cart", async () => {
    m.addItem.mockImplementation(() => fail("unauthenticated"));
    cartStore.dispatch(inc("a"));
    await tick(0);
    expect(cartStore.getMode()).toBe("guest");
    expect(cartStore.getSnapshot()).toEqual({});
    expect(stored()).toEqual({ lines: [] });
    cartStore.dispatch(inc("b"));
    expect(m.addItem).toHaveBeenCalledTimes(1);
    expect(stored()).toEqual({ lines: [{ slug: "b", qty: 1 }] });
  });

  it("after a 401 with requests queued, the next sign-in still adopts the server's lines", async () => {
    m.addItem.mockImplementationOnce(() => fail("unauthenticated"));
    cartStore.dispatch(inc("a"));
    cartStore.dispatch(inc("a"));
    cartStore.dispatch(inc("a"));
    await tick(0);
    expect(cartStore.getMode()).toBe("guest");
    m.mergeCart.mockImplementation(() => ok({ z: 5 }));
    m.getCart.mockImplementation(() => ok({ z: 5 }));
    await cartStore.signIn();
    m.addItem.mockImplementation(() => ok({ z: 5, y: 1, q: 2 })); // differs from the optimistic {z:5,y:1}
    cartStore.dispatch(inc("y"));
    await tick(0);
    expect(cartStore.getSnapshot()).toEqual({ z: 5, y: 1, q: 2 }); // the server's lines were adopted
    expect(m.addItem).toHaveBeenCalledTimes(2); // the queued ones from before the 401 were never sent
  });

  it("after a request that timed out, looks at the server's cart before any retry", async () => {
    m.addItem.mockImplementation(() => fail("network"));
    m.getCart.mockImplementation(() => ok({ a: 2 })); // the server did apply the add
    cartStore.dispatch(inc("a"));
    await tick(0);
    expect(m.getCart).toHaveBeenCalledTimes(2); // sign-in's load, then the refresh
    expect(cartStore.getSnapshot()).toEqual({ a: 2 });
  });

  it("a failed refresh is silent and does not revert a tap still on its way", async () => {
    const issues: CartIssue[] = [];
    cartStore.onIssue((i) => issues.push(i));
    let release: () => void = () => {};
    m.addItem
      .mockImplementationOnce(() => ok({ a: 2 }))
      .mockImplementationOnce(
        () => new Promise((r) => (release = () => r({ ok: true, view: view({ a: 3 }) } as never))),
      );
    m.getCart.mockImplementation(() => fail("network"));
    cartStore.dispatch(inc("a"));
    cartStore.refresh();
    cartStore.dispatch(inc("a")); // optimistic {a:3}, queued behind the refresh
    await tick(0); // the refresh has failed; the second add is still in flight
    expect(issues).toEqual([]);
    expect(cartStore.getSnapshot()).toEqual({ a: 3 });
    release();
    await tick(0);
    expect(cartStore.getSnapshot()).toEqual({ a: 3 });
  });

  it("a refresh that finds a 401 still drops to guest", async () => {
    m.getCart.mockImplementation(() => fail("unauthenticated"));
    cartStore.refresh();
    await tick(0);
    expect(cartStore.getMode()).toBe("guest");
  });

  it("two refreshes close together are one request", async () => {
    m.getCart.mockClear();
    m.getCart.mockImplementation(() => ok({ a: 1 }));
    cartStore.refresh();
    cartStore.refresh();
    await tick(0);
    expect(m.getCart).toHaveBeenCalledTimes(1);
    cartStore.refresh();
    await tick(0);
    expect(m.getCart).toHaveBeenCalledTimes(2);
  });

  it("refresh reloads the server cart through the queue", async () => {
    m.getCart.mockImplementation(() => ok({ a: 5 }));
    cartStore.refresh();
    await tick(0);
    expect(cartStore.getSnapshot()).toEqual({ a: 5 });
  });

  it("a listener that throws does not wedge the queue", async () => {
    cartStore.onIssue(() => {
      throw new Error("boom");
    });
    m.addItem.mockImplementationOnce(() => fail("network")).mockImplementation(() => ok({ a: 2 }));
    cartStore.dispatch(inc("a"));
    await tick(0);
    cartStore.dispatch(inc("a"));
    await tick(0);
    expect(m.addItem).toHaveBeenCalledTimes(2);
  });

  it("a 401 clears the waiting-refresh flag, so a later refresh is not swallowed", async () => {
    let release: () => void = () => {};
    m.addItem.mockImplementationOnce(
      () =>
        new Promise((r) => (release = () => r({ ok: false, error: "unauthenticated" } as never))),
    );
    cartStore.dispatch(inc("a"));
    cartStore.refresh(); // waits behind the add: the flag is set
    await tick(0); // the add is now in flight
    release(); // 401: the queue is abandoned, and the flag with it
    await tick(0);
    expect(cartStore.getMode()).toBe("guest");
    m.getCart.mockImplementation(() => ok({ z: 1 }));
    await cartStore.signIn();
    m.getCart.mockClear();
    cartStore.refresh();
    await tick(0);
    expect(m.getCart).toHaveBeenCalledTimes(1);
  });

  it("a sign-in call while changes are pending leaves it to their replies", async () => {
    m.addItem.mockImplementation(() => ok({ a: 2 }));
    cartStore.dispatch(inc("a"));
    m.getCart.mockClear();
    expect(await cartStore.signIn()).toEqual({ trimmed: false, removed: [] });
    expect(m.getCart).not.toHaveBeenCalled();
  });

  it("refuses locally, without a request, what the shared rules refuse", async () => {
    m.addItem.mockImplementation(() => ok({ a: 10 }));
    for (let i = 0; i < 9; i++) cartStore.dispatch(inc("a"));
    await tick(0);
    m.addItem.mockClear();
    expect(cartStore.dispatch(inc("a"))).toBe("product_limit");
    await tick(0);
    expect(m.addItem).not.toHaveBeenCalled();
  });
});
