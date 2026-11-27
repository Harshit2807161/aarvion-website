import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/lib/cart/api";
import { cartStore, resetCartStore } from "@/lib/cart/store";
import { useCartView } from "@/lib/cart/use-cart-view";
import { cartTotals } from "@/server/catalogue/cart-totals";
import { pricedLine, seedGuest } from "../../../tests/helpers/cart";

vi.mock("@/lib/cart/api", () => ({
  getCart: vi.fn(),
  addItem: vi.fn(),
  setQty: vi.fn(),
  removeItem: vi.fn(),
  mergeCart: vi.fn(),
  quoteCart: vi.fn(),
}));
const m = vi.mocked(api);

function Probe() {
  const v = useCartView();
  return (
    <p data-testid="p">
      {JSON.stringify({
        lines: v.lines.map((l) => [l.slug, l.qty]),
        payable: v.totals.payablePaise,
        pending: v.pending,
        updating: v.updating,
      })}
    </p>
  );
}
const read = () => JSON.parse(screen.getByTestId("p").textContent!);

/** Renders the probe on a stored cart of `a: 1` and lets its quote (Rs 407 a pack) arrive. */
async function pricedA() {
  seedGuest({ a: 1 });
  m.quoteCart.mockResolvedValue({
    ok: true,
    view: {
      lines: [pricedLine(1, { slug: "a", name: "A" })],
      totals: cartTotals([]),
      removed: [],
    },
  });
  render(<Probe />);
  act(() => cartStore.toGuest(true)); // what CartSync does on a page load: start pricing the stored cart
  await act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(500);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
  vi.resetAllMocks();
  resetCartStore();
});

describe("useCartView", () => {
  it("is empty before anything is priced and on the server", () => {
    render(<Probe />);
    expect(read()).toEqual({ lines: [], payable: 0, pending: [], updating: false });
  });

  it("joins the current quantities with the last priced facts and totals them", async () => {
    await pricedA();
    expect(read()).toEqual({ lines: [["a", 1]], payable: 38700, pending: [], updating: false });
    // A change moves the quantity at once; the price follows when the next quote lands.
    act(() => void cartStore.dispatch({ type: "inc", slug: "a" }));
    expect(read()).toMatchObject({ lines: [["a", 2]], payable: 77400, updating: true });
  });

  it("leaves a slug that is not priced yet out of the totals and lists it as pending", async () => {
    await pricedA();
    act(() => void cartStore.dispatch({ type: "inc", slug: "b" }));
    expect(read()).toEqual({
      lines: [["a", 1]],
      payable: 38700,
      pending: ["b"],
      updating: true,
    });
  });

  it("lists every slug as pending while nothing is priced", () => {
    m.quoteCart.mockReturnValue(new Promise(() => {})); // the quote never answers
    seedGuest({ a: 1 });
    render(<Probe />);
    act(() => void cartStore.dispatch({ type: "inc", slug: "a" }));
    expect(read()).toEqual({ lines: [], payable: 0, pending: ["a"], updating: true });
  });

  it("reports updating while a quote for newer lines is out, with the totals still computed, and clears it when it lands", async () => {
    await pricedA();
    let land!: () => void;
    m.quoteCart.mockReturnValue(
      new Promise((resolve) => {
        land = () =>
          resolve({
            ok: true,
            view: {
              lines: [pricedLine(2, { slug: "a", name: "A" })],
              totals: cartTotals([]),
              removed: [],
            },
          });
      }),
    );
    act(() => void cartStore.dispatch({ type: "inc", slug: "a" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500); // the quote is now in flight
    });
    expect(read()).toEqual({ lines: [["a", 2]], payable: 77400, pending: [], updating: true });
    await act(async () => {
      land();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(read()).toEqual({ lines: [["a", 2]], payable: 77400, pending: [], updating: false });
  });
});
