import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSessionState } from "@/components/auth/session-state";
import { announceSignedIn } from "@/components/auth/events";
import { LiveRegion } from "@/components/feedback/live-region";
import { getCart, mergeCart } from "@/lib/cart/api";
import { cartStore, resetCartStore } from "@/lib/cart/store";
import { seedGuest } from "../../../tests/helpers/cart";
import { CartSync } from "./cart-sync";

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
const live = () => document.getElementById("live")?.textContent ?? "";
const settle = async () => {
  await vi.dynamicImportSettled(); // the lazily loaded store halves
  await act(() => vi.advanceTimersByTimeAsync(200));
};
const view = (lines: Record<string, number>, extra: Record<string, unknown> = {}) =>
  ({
    ok: true,
    view: {
      lines: Object.entries(lines).map(([slug, qty]) => ({ slug, qty })),
      totals: {},
      removed: [],
      ...extra,
    },
  }) as never;

function setup(slugs = ["a"]) {
  return render(
    <>
      <CartSync slugs={slugs} />
      <LiveRegion />
    </>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  resetCartStore();
  vi.useFakeTimers();
  session.mockReset();
  vi.mocked(getCart).mockReset();
  vi.mocked(mergeCart).mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("CartSync on load", () => {
  it("signed out: stays a guest cart and says so once when it drops a product no longer sold", async () => {
    session.mockResolvedValue({ state: "out" });
    seedGuest({ gone: 2, a: 1 });
    setup();
    await settle();
    expect(cartStore.getMode()).toBe("guest");
    expect(cartStore.getSnapshot()).toEqual({ a: 1 });
    expect(live()).toBe("A medicine in your cart is no longer available, so it was removed.");
  });

  it("drops unsold lines so they free the 20-pack cap, and never touches an empty catalogue", async () => {
    session.mockResolvedValue({ state: "out" });
    seedGuest({ gone: 10, a: 10 });
    setup([]); // an empty catalogue means it is not loaded
    await settle();
    expect(cartStore.getSnapshot()).toEqual({ gone: 10, a: 10 });
    cleanup();
    resetCartStore();
    seedGuest({ gone: 10, a: 10 });
    setup(["a", "b"]);
    await settle();
    expect(cartStore.getSnapshot()).toEqual({ a: 10 });
    expect(cartStore.dispatch({ type: "inc", slug: "b" })).toBeNull(); // the cap is free again
  });

  it("signed in: signs the store in once, merging the guest cart", async () => {
    session.mockResolvedValue({ state: "in", name: null });
    seedGuest({ a: 1 });
    vi.mocked(mergeCart).mockResolvedValue(view({ a: 1 }));
    setup();
    await settle();
    expect(mergeCart).toHaveBeenCalledTimes(1);
    expect(cartStore.getMode()).toBe("user");
  });

  it("could not find out: changes nothing, so a flaky connection never hides a signed-in cart", async () => {
    session.mockResolvedValue({ state: "unknown" });
    seedGuest({ gone: 2, a: 1 });
    setup();
    await settle();
    expect(cartStore.getMode()).toBe("unknown");
    expect(cartStore.getSnapshot()).toEqual({ gone: 2, a: 1 });
    expect(live()).toBe("");
  });

  it("a stale 'nobody' answer that lands after a sign-in finished does not undo it", async () => {
    let answer: (v: { state: "out" }) => void = () => {};
    session.mockReturnValue(new Promise((r) => (answer = r)));
    vi.mocked(getCart).mockResolvedValue(view({ z: 3 }));
    setup();
    act(() => announceSignedIn());
    await settle();
    expect(cartStore.getMode()).toBe("user");
    await act(async () => answer({ state: "out" }));
    await settle();
    expect(cartStore.getMode()).toBe("user");
    expect(cartStore.getSnapshot()).toEqual({ z: 3 });
  });

  it("forgets the old v0 key", async () => {
    session.mockResolvedValue({ state: "out" });
    sessionStorage.setItem("aarv-cart-ui-v0", "{}");
    setup();
    await settle();
    expect(sessionStorage.getItem("aarv-cart-ui-v0")).toBeNull();
  });
});

describe("CartSync when the tab wakes up", () => {
  const wake = () =>
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

  it("reloads a signed-in cart, so another tab's change shows up", async () => {
    session.mockResolvedValue({ state: "in", name: null });
    vi.mocked(getCart).mockResolvedValue(view({ a: 1 }));
    setup();
    await settle();
    vi.mocked(getCart).mockResolvedValue(view({ a: 5 }));
    wake();
    await settle();
    expect(cartStore.getSnapshot()).toEqual({ a: 5 });
  });

  it("does not reload a guest cart", async () => {
    session.mockResolvedValue({ state: "out" });
    setup();
    await settle();
    wake();
    await settle();
    expect(getCart).not.toHaveBeenCalled();
  });

  it("asks once more when the first session check could not find out, then stops asking", async () => {
    session
      .mockResolvedValueOnce({ state: "unknown" })
      .mockResolvedValue({ state: "in", name: null });
    vi.mocked(getCart).mockResolvedValue(view({ a: 2 }));
    setup();
    await settle();
    expect(cartStore.getMode()).toBe("unknown");
    wake();
    await settle();
    expect(session).toHaveBeenCalledTimes(2);
    expect(cartStore.getMode()).toBe("user");
    act(() => void window.dispatchEvent(new Event("online")));
    await settle();
    expect(session).toHaveBeenCalledTimes(2); // a signed-in tab just refreshes now
  });
});

describe("a sign-in that failed", () => {
  it("says so once per visit, however often it is retried", async () => {
    session.mockResolvedValue({ state: "in", name: null });
    seedGuest({ a: 1 });
    vi.mocked(mergeCart).mockResolvedValue({ ok: false, error: "network" } as never);
    setup();
    await settle();
    expect(live()).toBe("We couldn’t update your cart. Check your connection and try again.");
    document.getElementById("live")!.textContent = "";
    act(() => void window.dispatchEvent(new Event("online"))); // retried, and fails again
    await settle();
    expect(mergeCart).toHaveBeenCalledTimes(2);
    expect(live()).toBe("");
  });

  it("a 401 stops the retries", async () => {
    session.mockResolvedValue({ state: "in", name: null });
    seedGuest({ a: 1 });
    vi.mocked(mergeCart).mockResolvedValue({ ok: false, error: "unauthenticated" } as never);
    setup();
    await settle();
    act(() => void window.dispatchEvent(new Event("online")));
    await settle();
    expect(mergeCart).toHaveBeenCalledTimes(1);
  });
});

describe("a sign-in whose code failed to load", () => {
  it("is tried again on the next wake-up, once", async () => {
    session.mockResolvedValue({ state: "in", name: null });
    const signIn = vi
      .spyOn(cartStore, "signIn")
      .mockResolvedValueOnce({ trimmed: false, removed: [], retry: true }); // the chunk failed: the store is not signed in
    vi.mocked(getCart).mockResolvedValue(view({ a: 1 }));
    setup();
    await settle();
    expect(signIn).toHaveBeenCalledTimes(1);
    act(() => void window.dispatchEvent(new Event("online")));
    await settle();
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(cartStore.getMode()).toBe("user"); // the retry went through the real store
    act(() => void window.dispatchEvent(new Event("online")));
    await settle();
    expect(signIn).toHaveBeenCalledTimes(2); // not a loop
    signIn.mockRestore();
  });
});

describe("CartSync on a sign-in event", () => {
  it("signs the store in once, and a /login sign-in merges the guest cart", async () => {
    session.mockResolvedValue({ state: "out" });
    seedGuest({ a: 2 });
    vi.mocked(mergeCart).mockResolvedValue(view({ a: 2, b: 1 }));
    setup();
    await settle();
    expect(mergeCart).not.toHaveBeenCalled();
    act(() => announceSignedIn());
    await settle();
    expect(mergeCart).toHaveBeenCalledTimes(1);
    expect(mergeCart).toHaveBeenCalledWith([{ slug: "a", qty: 2 }]);
    expect(cartStore.getSnapshot()).toEqual({ a: 2, b: 1 });
  });

  it("announces a dropped guest line and a trim in one message", async () => {
    session.mockResolvedValue({ state: "out" });
    seedGuest({ a: 1 });
    vi.mocked(mergeCart).mockResolvedValue(view({ a: 1 }, { trimmed: true, removed: ["ghost"] }));
    setup();
    await settle();
    act(() => announceSignedIn());
    await settle();
    expect(live()).toBe(
      "A medicine in your cart is no longer available, so it was removed. Your cart was full, so some packs weren’t added.",
    );
  });

  it("speaks a store issue, such as a lost request, through the live region", async () => {
    session.mockResolvedValue({ state: "out" });
    vi.mocked(getCart).mockResolvedValue({ ok: false, error: "network" } as never);
    setup();
    await settle();
    await act(async () => void (await cartStore.signIn()));
    await settle();
    expect(live()).toBe("We couldn’t update your cart. Check your connection and try again.");
  });

  it("stops listening when it unmounts", async () => {
    session.mockResolvedValue({ state: "out" });
    const { unmount } = setup([]);
    await settle();
    unmount();
    act(() => announceSignedIn());
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    await settle();
    expect(getCart).not.toHaveBeenCalled();
    expect(mergeCart).not.toHaveBeenCalled();
  });
});
