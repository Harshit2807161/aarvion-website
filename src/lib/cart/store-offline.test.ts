import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCartStore, cartStore } from "./store";

// The quoting chunk cannot be loaded (offline): the dynamic import rejects.
vi.mock("./guest-quote", () => {
  throw new Error("chunk failed");
});

let online: (() => void)[];

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
  online = [];
  vi.stubGlobal(
    "addEventListener",
    (type: string, fn: () => void) => type === "online" && online.push(fn),
  );
  resetCartStore();
});
afterEach(() => vi.unstubAllGlobals());

describe("a quote chunk that fails to load", () => {
  it("waits for the network to return, once, instead of the next tap", async () => {
    cartStore.dispatch({ type: "inc", slug: "a" });
    await vi.dynamicImportSettled();
    await Promise.resolve();
    expect(online).toHaveLength(1);
    online[0]!(); // the network is back: it asks again (and fails again, here)
    await vi.dynamicImportSettled();
    await Promise.resolve();
    expect(online).toHaveLength(2); // one more wait per failure, never a loop
    expect(cartStore.isViewStale()).toBe(true);
  });
});
