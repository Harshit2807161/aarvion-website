import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SITE_CONFIG } from "@/config/site";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { findClaims } from "../../../tests/helpers/claims";
import { ProductFacts } from "./product-facts";
import { VariantSwitcher } from "./variant-switcher";

const NB = "\u00a0";
const catalogue = publicCatalogue();
const bySlug = (s: string) => catalogue.find((p) => p.slug === s)!;
const family = (slug: string) => catalogue.filter((p) => p.familySlug === bySlug(slug).familySlug);

function facts(slug: string) {
  const { container } = render(<ProductFacts product={bySlug(slug)} />);
  const dl = container.querySelector<HTMLElement>("dl.product-facts")!;
  const get = (label: string) => {
    const dt = within(dl).getByText(label, { selector: "dt" });
    return dt.nextElementSibling as HTMLElement;
  };
  return { dl, get };
}

describe("ProductFacts", () => {
  afterEach(() => {
    SITE_CONFIG.customerCare = null;
  });

  it("lists the declarations in order", () => {
    const { dl } = facts("sacuwin-100");
    expect([...dl.querySelectorAll("dt")].map((d) => d.textContent)).toEqual([
      "Composition",
      "Dosage form",
      "Net quantity",
      "MRP",
      "Manufacturer",
      "Marketer",
      "Country of origin",
      "Customer care",
    ]);
  });

  it("shows sacuwin-100 with its manufacturer, marketer and India", () => {
    const { get } = facts("sacuwin-100");
    expect(get("Manufacturer").textContent).toBe(
      "Mascot Health Series Pvt. Ltd., Plot 79-80, Sec-6A, IIE, SIDCUL, Haridwar 249403",
    );
    expect(get("Country of origin").textContent).toBe("India");
    expect(get("Marketer").textContent).toBe(
      "Aarvion Pharmaceuticals, Plot No. 70, Second Floor, Functional Industrial Estate, Patparganj, New Delhi 110092",
    );
    expect(get("Net quantity").textContent).toBe(`Strip of 14${NB}tablets`);
    expect(get("MRP").textContent).toBe("₹407 inclusive of all taxes");
  });

  it("tabulates the composition", () => {
    const { get } = facts("sacuwin-100");
    const rows = [...get("Composition").querySelectorAll("tbody tr")].map((r) =>
      [...r.children].map((c) => c.textContent),
    );
    expect(rows).toEqual([
      ["Sacubitril (as sodium)", "49 mg"],
      ["Valsartan", "51 mg"],
    ]);
  });

  it("renders Pending, never an invented value, for hyloage", () => {
    const { get } = facts("hyloage");
    expect(get("Manufacturer").textContent).toBe("To be added");
    expect(get("Manufacturer").querySelector(".pending")).not.toBeNull();
    expect(get("Country of origin").textContent).toBe("To be added");
    expect(get("Net quantity").textContent).toBe(`10${NB}ml bottle`);
  });

  it("shows customer care as Pending while SITE_CONFIG has none", () => {
    const { get } = facts("sacuwin-100");
    expect(get("Customer care").querySelector(".pending")?.textContent).toBe("To be added");
  });

  it("prints customer care once phone and email are both set, Pending if only one is", () => {
    const saved = SITE_CONFIG.customerCare;
    SITE_CONFIG.customerCare = { phone: "+91 11 5555 0100", email: "care@example.test" };
    expect(facts("sacuwin-100").get("Customer care").textContent).toBe(
      "+91 11 5555 0100, care@example.test",
    );
    document.body.innerHTML = "";
    SITE_CONFIG.customerCare = { phone: "+91 11 5555 0100", email: null };
    expect(facts("sacuwin-100").get("Customer care").textContent).toBe("To be added");
    SITE_CONFIG.customerCare = saved;
  });

  it("makes no banned claim and adds no live region", () => {
    const { dl } = facts("sacuwin-100");
    expect(findClaims(dl.textContent ?? "")).toEqual([]);
    expect(dl.querySelector("[aria-live], [role=status]")).toBeNull();
  });
});

describe("VariantSwitcher", () => {
  it("links 50, 100 and 200 with aria-current only on the current one", () => {
    render(<VariantSwitcher family={[...family("sacuwin-100")].reverse()} current={bySlug("sacuwin-100")} />);
    const nav = screen.getByRole("navigation", { name: "Strengths" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["50", "/product/sacuwin-50"],
      ["100", "/product/sacuwin-100"],
      ["200", "/product/sacuwin-200"],
    ]);
    expect(links.map((a) => a.getAttribute("aria-current"))).toEqual([null, "page", null]);
    expect(nav.querySelector("[aria-live], [role=status]")).toBeNull();
  });

  it("renders nothing for a family of one", () => {
    const { container } = render(
      <VariantSwitcher family={family("hyloage")} current={bySlug("hyloage")} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
