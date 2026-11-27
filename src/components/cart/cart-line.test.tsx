import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveRegion } from "@/components/feedback/live-region";
import * as api from "@/lib/cart/api";
import { cartStore, resetCartStore } from "@/lib/cart/store";
import { cartTotals } from "@/server/catalogue/pricing";
import { findClaims } from "../../../tests/helpers/claims";
import { pricedLine as line, seedGuest } from "../../../tests/helpers/cart";
import { CartLineItem } from "./cart-line";

vi.mock("@/lib/cart/api", () => ({
  getCart: vi.fn(),
  addItem: vi.fn(),
  setQty: vi.fn(),
  removeItem: vi.fn(),
  mergeCart: vi.fn(),
  quoteCart: vi.fn(),
}));
const m = vi.mocked(api);

const spoken = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60);
  });
  return document.getElementById("live")!.textContent;
};
/** The text a shopper sees: screen-reader-only text is left out. */
const seen = (el: Element) => {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll(".sr-only").forEach((n) => n.remove());
  return copy.textContent!.replace(/\s+/g, " ").trim();
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
  vi.resetAllMocks();
  resetCartStore();
});

describe("CartLineItem", () => {
  const renderLine = (qty: number, variant: "full" | "compact" = "full") =>
    render(
      <>
        <ul>
          <CartLineItem line={line(qty)} variant={variant} />
        </ul>
        <LiveRegion />
      </>,
    );

  it("renders the prototype markup with the struck MRP, the price and the price each", () => {
    renderLine(2);
    const li = document.querySelector("li.line[data-slug='sacuwin-100']")!;
    expect(li.querySelector(".well")).not.toBeNull();
    expect(li.querySelector(".line-name")!.textContent).toContain("Sacuwin 100");
    expect(li.querySelector(".line-name abbr.rx")).not.toBeNull();
    expect(li.querySelector(".line-salt")!.textContent).toBe(
      "Sacubitril (as sodium) 24 mg + Valsartan 26 mg",
    );
    expect(li.querySelector(".line-pack")!.textContent).toContain("30");
    expect(seen(li.querySelector("s.mrp")!)).toBe("₹814");
    expect(seen(li.querySelector("b.price")!)).toBe("₹774");
    expect(seen(li.querySelector(".each")!)).toBe("₹387 each");
  });

  it("shows no 'each' at one pack and no Rx badge for an OTC product", () => {
    render(
      <ul>
        <CartLineItem line={line(1, { rxRequired: false })} variant="full" />
      </ul>,
    );
    expect(document.querySelector(".each")).toBeNull();
    expect(document.querySelector(".line-name abbr.rx")).toBeNull();
  });

  it("has a labelled stepper, with Remove text in full and an icon only when compact", () => {
    const { unmount } = renderLine(3);
    const group = screen.getByRole("group", { name: "Quantity of Sacuwin 100" });
    expect(group.classList.contains("line-stepper")).toBe(true);
    expect(screen.getByRole("button", { name: "One fewer Sacuwin 100" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "One more Sacuwin 100" })).toBeTruthy();
    expect(group.querySelector("span")!.textContent).toBe("3");
    const remove = screen.getByRole("button", { name: "Remove Sacuwin 100 from cart" });
    expect(remove.textContent).toBe("Remove");
    unmount();
    renderLine(3, "compact");
    expect(screen.getByRole("button", { name: "Remove Sacuwin 100 from cart" }).textContent).toBe("");
  });

  it("disables the minus at 1 and the plus at 10, where .line-max says why", () => {
    const { unmount } = renderLine(1);
    expect(document.querySelector("[data-dec]")!.getAttribute("aria-disabled")).toBe("true");
    expect(document.querySelector("[data-inc]")!.getAttribute("aria-disabled")).toBe("false");
    expect(document.querySelector<HTMLElement>(".line-max")!.hidden).toBe(true);
    unmount();
    renderLine(10);
    expect(document.querySelector("[data-inc]")!.getAttribute("aria-disabled")).toBe("true");
    expect(document.querySelector("[data-dec]")!.getAttribute("aria-disabled")).toBe("false");
    const max = document.querySelector<HTMLElement>(".line-max")!;
    expect(max.hidden).toBe(false);
    expect(max.textContent).toBe("Up to 10 of each per order");
  });

  it("reads '20-pack order limit reached' when the order is full", () => {
    seedGuest({ "sacuwin-100": 5, other: 10, more: 5 });
    renderLine(5);
    expect(document.querySelector("[data-inc]")!.getAttribute("aria-disabled")).toBe("true");
    expect(document.querySelector(".line-max")!.textContent).toBe("20-pack order limit reached");
  });

  it("steps the quantity through the store and says so through #live", async () => {
    seedGuest({ "sacuwin-100": 2 });
    renderLine(2);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
      document.querySelector("[data-inc]")!,
    );
    expect(cartStore.getSnapshot()["sacuwin-100"]).toBe(3);
    expect(await spoken()).toBe("Sacuwin 100: 3 in cart");
  });

  it("explains a refused plus through #live instead of going silent", async () => {
    seedGuest({ "sacuwin-100": 10 });
    renderLine(10);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
      document.querySelector("[data-inc]")!,
    );
    expect(cartStore.getSnapshot()["sacuwin-100"]).toBe(10);
    expect(await spoken()).toBe("You can order up to 10 packs of Sacuwin 100.");
  });

  it("does nothing on the disabled minus at 1", async () => {
    seedGuest({ "sacuwin-100": 1 });
    renderLine(1);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
      document.querySelector("[data-dec]")!,
    );
    expect(cartStore.getSnapshot()["sacuwin-100"]).toBe(1);
  });

  it("removes through the store and announces it through #live", async () => {
    seedGuest({ "sacuwin-100": 2 });
    const dispatch = vi.spyOn(cartStore, "dispatch");
    renderLine(2);
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole("button", { name: "Remove Sacuwin 100 from cart" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "remove", slug: "sacuwin-100" });
    expect(await spoken()).toBe("Sacuwin 100 removed from cart");
  });

  it("adds no output and no live region of its own", () => {
    renderLine(2);
    const li = document.querySelector("li.line")!;
    expect(li.querySelector("output")).toBeNull();
    expect(li.querySelector("[aria-live], [role=status], [role=alert]")).toBeNull();
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
  });

  it("makes no health claim", () => {
    const { container } = renderLine(2);
    expect(findClaims(container.textContent ?? "")).toEqual([]);
  });

  it("uses the relative inc and dec when signed in, so a stale tab cannot overwrite the server's quantity", async () => {
    const cart = (qty: number) => ({
      ok: true as const,
      view: { lines: [line(qty)], totals: cartTotals([]), removed: [] },
    });
    m.getCart.mockResolvedValue(cart(2));
    m.addItem.mockResolvedValue(cart(7));
    m.setQty.mockResolvedValue(cart(1));
    await act(async () => void (await cartStore.signIn()));
    renderLine(2);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(document.querySelector("[data-inc]")!);
    await act(async () => void (await vi.advanceTimersByTimeAsync(10)));
    expect(m.addItem).toHaveBeenCalledWith("sacuwin-100", 1);
    expect(m.setQty).not.toHaveBeenCalledWith("sacuwin-100", 3);
  });

  it("takes the name's heading level, h3 by default", () => {
    const { unmount } = renderLine(1);
    expect(document.querySelector("h3.line-name")).not.toBeNull();
    unmount();
    render(
      <ul>
        <CartLineItem line={line(1)} variant="full" heading="h2" />
      </ul>,
    );
    expect(document.querySelector("h2.line-name")).not.toBeNull();
    expect(document.querySelector("h3")).toBeNull();
  });
});
