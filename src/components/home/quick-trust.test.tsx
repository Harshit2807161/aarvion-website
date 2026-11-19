import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { findClaims } from "../../../tests/helpers/claims";
import { ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";
import { QuickActions } from "./quick-actions";
import { TrustStrip } from "./trust-strip";

describe("QuickActions", () => {
  it("is the Quick actions landmark with four cards linking to the right places, in order", () => {
    const { container } = render(<QuickActions />);
    const section = container.querySelector("section.quick.wrap");
    expect(section?.getAttribute("aria-label")).toBe("Quick actions");
    const cards = [...container.querySelectorAll("a.qa")];
    expect(cards.map((a) => a.querySelector(".qa-title")?.textContent)).toEqual([
      "Order with a prescription",
      "Search for a medicine",
      "Track an order",
      "Contact us",
    ]);
    expect(cards.map((a) => a.getAttribute("href"))).toEqual([
      ROUTES.uploadRx,
      "#q",
      ROUTES.account,
      ROUTES.contact,
    ]);
    expect(cards[0]?.classList.contains("qa--rx")).toBe(true);
    expect(container.querySelectorAll(".qa--rx")).toHaveLength(1);
  });

  it("marks the search card for the header search and gives every card a well and a chevron", () => {
    const { container } = render(<QuickActions />);
    expect(
      screen.getByRole("link", { name: /Search for a medicine/ }).hasAttribute("data-search"),
    ).toBe(true);
    for (const a of container.querySelectorAll("a.qa")) {
      expect(a.querySelector(".qa-well svg.i")).not.toBeNull();
      expect(a.querySelector(":scope > svg.i")).not.toBeNull();
    }
  });

  it("carries the prototype lines and no invented claims", () => {
    const { container } = render(<QuickActions />);
    expect([...container.querySelectorAll(".qa-line")].map((n) => n.textContent)).toEqual([
      "Upload a photo or PDF",
      "By brand, salt or strength",
      "See where your order is",
      "Address and support details",
    ]);
    expect(findClaims(container.textContent ?? "")).toEqual([]);
  });
});

describe("TrustStrip", () => {
  it("is the Why order landmark with four items and no digits", () => {
    const { container } = render(<TrustStrip />);
    const section = container.querySelector("section.trust.wrap");
    expect(section?.getAttribute("aria-label")).toBe("Why order from Aarvion");
    const items = [...container.querySelectorAll(".trust-row li")];
    expect(items).toHaveLength(4);
    expect(items.map((li) => li.querySelector("b")?.textContent)).toEqual([
      "Genuine medicines",
      "Pharmacist-checked",
      "Free delivery",
      "Cash on delivery",
    ]);
    for (const li of items) expect(li.querySelector("svg.i")).not.toBeNull();
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("says pay on arrival while online payments are off, and offers Razorpay once they are live", () => {
    expect(SITE_CONFIG.onlinePayments).toBe(false);
    const off = render(<TrustStrip />);
    expect(off.container.textContent).toContain("Pay when your order arrives");
    expect(off.container.textContent).not.toMatch(/Razorpay|online/i);
    off.unmount();
    const on = render(<TrustStrip onlinePayments />);
    expect(on.container.textContent).toContain("Or pay online with Razorpay");
    expect(on.container.textContent).not.toContain("Pay when your order arrives");
  });

  it("makes no invented claims in either state", () => {
    for (const onlinePayments of [false, true]) {
      const { container, unmount } = render(<TrustStrip onlinePayments={onlinePayments} />);
      expect(findClaims(container.textContent ?? "")).toEqual([]);
      unmount();
    }
  });
});
