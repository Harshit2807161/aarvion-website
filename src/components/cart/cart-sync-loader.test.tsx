import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSessionState } from "@/components/auth/session-state";
import { announceSignedIn } from "@/components/auth/events";
import { getCart, mergeCart } from "@/lib/cart/api";
import { cartStore, resetCartStore } from "@/lib/cart/store";
import { seedGuest } from "../../../tests/helpers/cart";
import { CartSyncLoader } from "./cart-sync-loader";

vi.mock("@/components/auth/session-state", () => ({ fetchSessionState: vi.fn() }));
vi.mock("@/lib/cart/api", () => ({
  getCart: vi.fn(),
  addItem: vi.fn(),
  setQty: vi.fn(),
  removeItem: vi.fn(),
  mergeCart: vi.fn(),
  quoteCart: vi.fn(async () => ({ ok: false, error: "network" })),
}));

const session = vi.mocked(fetchSessionState);
const view = (lines: Record<string, number>) =>
  ({
    ok: true,
    view: {
      lines: Object.entries(lines).map(([slug, qty]) => ({ slug, qty })),
      totals: {},
      removed: [],
    },
  }) as never;

let idle: (() => void) | null;
let idleOpts: { timeout?: number } | undefined;
beforeEach(() => {
  sessionStorage.clear();
  resetCartStore();
  session.mockReset();
  session.mockResolvedValue({ state: "in", name: null });
  vi.mocked(mergeCart)
    .mockReset()
    .mockResolvedValue(view({ a: 1 }));
  vi.mocked(getCart)
    .mockReset()
    .mockResolvedValue(view({ a: 1 }));
  idle = null;
  Object.assign(window, {
    requestIdleCallback: (fn: () => void, opts?: { timeout?: number }) => (
      (idle = fn),
      (idleOpts = opts),
      1
    ),
    cancelIdleCallback: () => {
      idle = null;
    },
  });
});
afterEach(() => {
  cleanup(); // unmount while the idle helpers still exist
  Reflect.deleteProperty(window, "requestIdleCallback");
  Reflect.deleteProperty(window, "cancelIdleCallback");
});

const settle = async () => {
  await vi.dynamicImportSettled();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

describe("CartSyncLoader", () => {
  it("renders nothing and loads CartSync only when the browser is idle", async () => {
    const { container } = render(<CartSyncLoader slugs={["a"]} />);
    await settle();
    expect(container).toBeEmptyDOMElement();
    expect(session).not.toHaveBeenCalled(); // nothing has mounted yet
    expect(idleOpts).toEqual({ timeout: 2000 }); // idle, but never later than 2 s
    act(() => idle?.());
    await settle();
    expect(session).toHaveBeenCalledTimes(1);
  });

  it.each(["pointerDown", "keyDown"] as const)(
    "loads it at once on the first %s, and only once",
    async (kind) => {
      render(<CartSyncLoader slugs={["a"]} />);
      fireEvent[kind](document.body);
      await settle();
      expect(session).toHaveBeenCalledTimes(1);
      fireEvent[kind](document.body);
      act(() => idle?.());
      await settle();
      expect(session).toHaveBeenCalledTimes(1);
    },
  );

  it("a sign-in announced before it mounts still merges the guest cart, because the mount checks the session", async () => {
    seedGuest({ a: 1 });
    render(<CartSyncLoader slugs={["a"]} />);
    act(() => announceSignedIn()); // nobody is listening yet
    await settle();
    expect(mergeCart).not.toHaveBeenCalled();
    act(() => idle?.());
    await settle();
    expect(mergeCart).toHaveBeenCalledTimes(1);
    expect(mergeCart).toHaveBeenCalledWith([{ slug: "a", qty: 1 }]);
    expect(cartStore.getMode()).toBe("user");
  });

  it("falls back to a timer where there is no idle callback, and cleans up on unmount", async () => {
    Reflect.deleteProperty(window, "requestIdleCallback"); // no idle callbacks in this browser
    Reflect.deleteProperty(window, "cancelIdleCallback");
    vi.useFakeTimers();
    const { unmount } = render(<CartSyncLoader slugs={["a"]} />);
    await vi.advanceTimersByTimeAsync(1400);
    expect(session).not.toHaveBeenCalled(); // the timer is not an immediate call
    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(session).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
