import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cartTotals } from "@/server/catalogue/cart-totals";
import { findClaims } from "../../../tests/helpers/claims";
import { CartSummary } from "./cart-summary";

/** The text a shopper sees: screen-reader-only text is left out. */
const seen = (el: Element) => {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll(".sr-only").forEach((n) => n.remove());
  return copy.textContent!.replace(/\s+/g, " ").trim();
};

describe("CartSummary", () => {
  // The K1 example: 3 packs, MRP total Rs 1,077, payable Rs 1,017.
  const totals = cartTotals([
    { mrpPaise: 40700, qty: 1 },
    { mrpPaise: 33500, qty: 2 },
  ]);

  it("reads the prototype's receipt for the K1 totals", () => {
    const { container } = render(<CartSummary totals={totals} kind="full" />);
    const rows = [...container.querySelectorAll(".sum > div")].map((r) => ({
      dt: seen(r.querySelector("dt")!),
      dd: seen(r.querySelector("dd")!),
    }));
    expect(rows).toEqual([
      { dt: "MRP total", dd: "₹1,077" },
      { dt: "Aarvion discount ₹20 × 3 packs", dd: "−₹60" },
      { dt: "Delivery", dd: "Free" },
      { dt: "Total payable", dd: "₹1,017" },
    ]);
    expect(container.querySelector(".sum-tax")!.textContent).toBe("Inclusive of all taxes");
    expect(container.querySelector(".sum-total .dm")).not.toBeNull();
    expect(container.querySelector(".sum-off dd .sr-only")!.textContent).toBe("minus ");
  });

  it("says '1 pack' for one pack", () => {
    const { container } = render(
      <CartSummary totals={cartTotals([{ mrpPaise: 40700, qty: 1 }])} kind="full" />,
    );
    expect(seen(container.querySelector(".sum-off dt")!)).toBe("Aarvion discount ₹20 × 1 pack");
  });

  it("renders the mini summary", () => {
    const { container } = render(<CartSummary totals={totals} kind="mini" />);
    expect(container.querySelector("dl.sum--mini .sum-total")).not.toBeNull();
    expect(container.querySelector(".sum-tax")!.textContent).toBe(
      "MRP ₹1,077 less ₹60 Aarvion discountFree delivery · Inclusive of all taxes",
    );
  });

  it("says the totals are updating while stale, and not otherwise", () => {
    const { container, rerender } = render(<CartSummary totals={totals} kind="full" />);
    expect(container.querySelector(".sum-updating")).toBeNull();
    rerender(<CartSummary totals={totals} kind="full" updating />);
    expect(container.querySelector(".sum-updating")!.textContent).toBe("Updating totals…");
    expect(container.querySelector(".sum")!.getAttribute("data-updating")).toBe("true");
    expect(container.querySelector("[aria-live], output")).toBeNull();
  });

  it("makes no health claim", () => {
    const { container } = render(<CartSummary totals={totals} kind="full" />);
    expect(findClaims(container.textContent ?? "")).toEqual([]);
  });
});
