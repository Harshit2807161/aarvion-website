import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchSessionState } from "@/components/auth/session-state";
import { LiveRegion } from "@/components/feedback/live-region";
import * as api from "@/lib/cart/api";
import { resetCartStore } from "@/lib/cart/store";
import { cartTotals } from "@/server/catalogue/cart-totals";
import { pricedLine, seedGuest } from "../../../tests/helpers/cart";
import { CartPage } from "./cart-page";
import { CartSync } from "./cart-sync";

/**
 * P3-M2: the cart page and CartSync both see a signed-in session and both sign the store in. The
 * store shares one sign-in, so the guest cart is merged exactly once, and the page shows the lines.
 */
vi.mock("@/components/auth/session-state", () => ({ fetchSessionState: vi.fn() }));
vi.mock("@/lib/cart/api", () => ({
  getCart: vi.fn(),
  addItem: vi.fn(),
  setQty: vi.fn(),
  removeItem: vi.fn(),
  mergeCart: vi.fn(),
  quoteCart: vi.fn(() => new Promise(() => {})),
}));
const m = vi.mocked(api);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
  resetCartStore();
  vi.mocked(fetchSessionState).mockResolvedValue({ state: "in", name: "Asha" });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const settle = () =>
  act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(100);
    await vi.dynamicImportSettled();
  });

it("merges the guest cart once when the page and CartSync sign in together", async () => {
  seedGuest({ "sacuwin-100": 2 });
  const line = pricedLine(2);
  let release!: (v: unknown) => void;
  m.mergeCart.mockImplementation(() => new Promise((r) => (release = r)) as never);

  render(
    <>
      <CartPage
        medicineWord="eleven"
        onlinePayments={false}
        known={{ "sacuwin-100": { name: "Sacuwin 100", rx: true } }}
      />
      <CartSync slugs={["sacuwin-100"]} />
      <LiveRegion />
    </>,
  );
  await settle();
  expect(fetchSessionState).toHaveBeenCalledTimes(2); // the page's check and CartSync's
  expect(m.mergeCart).toHaveBeenCalledTimes(1); // one shared sign-in

  await act(async () =>
    release({ ok: true, view: { lines: [line], totals: cartTotals([line]), removed: [] } }),
  );
  await settle();
  expect(m.mergeCart).toHaveBeenCalledTimes(1);
  expect(m.getCart).not.toHaveBeenCalled();
  expect(document.querySelector("li.line[data-slug='sacuwin-100']")).not.toBeNull();
  expect(document.querySelector(".receipt a[data-checkout]")!.getAttribute("href")).toBe(
    "/checkout",
  );
});
