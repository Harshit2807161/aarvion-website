import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Rupees } from "./rupees";
import { PriceInline, StampPrice } from "./stamp-price";

describe("StampPrice", () => {
  it("renders the v2 stamp for MRP 40700", () => {
    const { container } = render(<StampPrice mrpPaise={40700} />);
    expect(container.querySelector("p.stamp")).not.toBeNull();
    expect(container.querySelector("s.stamp-mrp")?.textContent).toBe("Printed MRP ₹407");
    expect(container.querySelector(".off")?.textContent).toBe(", 4% off");
    expect(container.querySelector(".stamp-price .dm")?.textContent).toBe("₹387");
    expect(container.querySelector(".stamp-price")?.textContent).toBe(", our price ₹387");
  });

  it("floors the % off (20900 is 9%)", () => {
    const { container } = render(<StampPrice mrpPaise={20900} />);
    expect(container.querySelector(".off")?.textContent).toBe(", 9% off");
    expect(container.querySelector(".stamp-price .dm")?.textContent).toBe("₹189");
  });

  it("merges className", () => {
    const { container } = render(<StampPrice mrpPaise={40700} className="x" />);
    expect(container.querySelector("p.stamp.x")).not.toBeNull();
  });

  it("throws RangeError for an MRP that cannot carry a price", () => {
    expect(() => render(<StampPrice mrpPaise={2000} />)).toThrow(RangeError);
  });
});

describe("PriceInline", () => {
  it("shows the struck MRP and the price in solid mono with sans commas", () => {
    const { container } = render(<PriceInline mrpPaise={117900} />);
    expect(container.querySelector("span.price-inline > s")?.textContent).toBe("MRP ₹1,179");
    expect(container.querySelector("span.price-inline > b")?.textContent).toBe("₹1,159");
    expect(container.querySelectorAll("span.cm")).toHaveLength(2);
  });
});

describe("Rupees", () => {
  it("wraps each comma in span.cm", () => {
    const { container } = render(<Rupees paise={10000000} />);
    expect(container.textContent).toBe("₹1,00,000");
    expect(container.querySelectorAll("span.cm")).toHaveLength(2);
  });

  it("has no span for amounts without commas", () => {
    const { container } = render(<Rupees paise={38700} />);
    expect(container.querySelector("span.cm")).toBeNull();
    expect(container.textContent).toBe("₹387");
  });
});
