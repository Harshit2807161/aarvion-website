import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The CartSync chunk fails to load (offline) the first time, then loads.
vi.mock("@/components/auth/session-state", () => ({ fetchSessionState: vi.fn() }));
vi.mock("@/lib/cart/api", () => ({
  getCart: vi.fn(),
  addItem: vi.fn(),
  setQty: vi.fn(),
  removeItem: vi.fn(),
  mergeCart: vi.fn(),
  quoteCart: vi.fn(async () => ({ ok: false, error: "network" })),
}));

const settle = async () => {
  await vi.dynamicImportSettled();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

afterEach(() => cleanup());

describe("CartSyncLoader when its chunk fails to load", () => {
  it.each([
    ["a press", () => window.dispatchEvent(new Event("pointerdown"))],
    ["a key", () => window.dispatchEvent(new Event("keydown"))],
    ["the network returning", () => window.dispatchEvent(new Event("online"))],
    ["the tab becoming visible", () => document.dispatchEvent(new Event("visibilitychange"))],
  ])("stays armed and tries again on %s", async (_name, retry) => {
    vi.resetModules(); // fresh modules, so the mock factory below runs again
    let failures = 1;
    vi.doMock("./cart-sync", async (importOriginal) => {
      if (failures-- > 0) throw new Error("chunk failed");
      return importOriginal();
    });
    const { CartSyncLoader } = await import("./cart-sync-loader");
    const { fetchSessionState } = await import("@/components/auth/session-state");
    const session = vi.mocked(fetchSessionState).mockResolvedValue({ state: "out" });
    render(<CartSyncLoader slugs={["a"]} />);
    act(() => void window.dispatchEvent(new Event("pointerdown"))); // the first try: the chunk fails
    await settle();
    expect(session).not.toHaveBeenCalled();
    act(() => retry());
    await settle();
    expect(session).toHaveBeenCalledTimes(1); // the retry loaded and mounted it
  });
});
