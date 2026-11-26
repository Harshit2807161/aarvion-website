import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { findClaims } from "../../../tests/helpers/claims";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import type { PublicProduct } from "@/server/catalogue/queries";
import { ProductView } from "./product-view";

const NB = " ";
const catalogue = publicCatalogue();
const bySlug = (s: string) => catalogue.find((p) => p.slug === s)!;

function view(product: PublicProduct) {
  const family = catalogue.filter((p) => p.familySlug === product.familySlug);
  const category = CATEGORY_LIST.find((c) => c.slug === product.category)!;
  const related = catalogue.filter((p) => p.category === product.category && p.slug !== product.slug).slice(0, 4);
  const { container } = render(
    <ProductView product={product} family={family} category={category} related={related} />,
  );
  return container;
}

describe("ProductView", () => {
  const sacuwin = bySlug("sacuwin-100");

  it("reads brand, composition, pack, price in the buy box", () => {
    const c = view(sacuwin);
    expect([...c.querySelectorAll("[data-hierarchy]")].map((e) => (e as HTMLElement).dataset.hierarchy)).toEqual([
      "brand",
      "composition",
      "pack",
      "price",
    ]);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveClass("product-name");
    expect(h1.textContent).toContain("Sacuwin 100");
    expect(c.querySelector("[data-hierarchy=brand] abbr.rx")).not.toBeNull();
    expect(c.querySelector("[data-hierarchy=composition]")?.textContent).toBe(
      "Sacubitril (as sodium) 49 mg + Valsartan 51 mg",
    );
    expect(c.querySelector("[data-hierarchy=pack]")?.textContent).toBe(
      `Strip of 14${NB}tablets · Film-coated tablet`,
    );
    const price = c.querySelector("[data-hierarchy=price]")!;
    expect(price.querySelector(".stamp-mrp .dm")?.textContent).toBe("MRP ₹407");
    expect(price.querySelector(".off")?.textContent).toContain("4% off");
    expect(price.querySelector(".stamp-price .dm")?.textContent).toBe("₹387");
    expect(price.textContent).toContain("Inclusive of all taxes");
  });

  it("puts the strength switcher, Add to cart and the order limit after the price", () => {
    const c = view(sacuwin);
    expect(screen.getByRole("navigation", { name: "Strengths" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Sacuwin 100 to cart" })).toBeInTheDocument();
    expect(c.textContent).toContain("Up to 10 packs of each medicine per order.");
  });

  it("loads the first photo eagerly at high priority and the rest lazily, with fixed sizes", () => {
    const c = view(sacuwin);
    const imgs = [...c.querySelectorAll<HTMLImageElement>(".gallery figure img")];
    expect(imgs).toHaveLength(sacuwin.images.length);
    expect(imgs[0]).toHaveAttribute("loading", "eager");
    expect(imgs[0]).toHaveAttribute("fetchpriority", "high");
    expect(imgs[0]).toHaveAttribute("width");
    expect(imgs[0]).toHaveAttribute("height");
    for (const img of imgs.slice(1)) {
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).not.toHaveAttribute("fetchpriority");
    }
    expect(c.querySelector("link[rel=preload]")).toBeNull();
    expect([...c.querySelectorAll(".gallery figure")].map((f) => f.id)).toEqual(
      sacuwin.images.map((_, i) => `photo-${i + 1}`),
    );
    expect([...c.querySelectorAll(".gallery-thumbs a")].map((a) => a.getAttribute("href"))).toEqual(
      sacuwin.images.map((_, i) => `#photo-${i + 1}`),
    );
  });

  it("has no Win2Age caption for an Aarvion-printed pack, and one for a Win2Age pack", () => {
    expect(view(sacuwin).textContent).not.toContain("Win2Age");
    document.body.innerHTML = "";
    const c = view(bySlug("bemptor-180"));
    expect(c.textContent).toContain(
      "Photo shows the pack printed under Win2Age Pharma, Aarvion’s earlier marketing name.",
    );
  });

  it("shows the Rx note only when a prescription is required", () => {
    const note = "Requires a valid prescription. You add it at checkout, and a pharmacist checks it before your order is packed.";
    expect(view(sacuwin).textContent).toContain(note);
    document.body.innerHTML = "";
    expect(view({ ...sacuwin, rxRequired: false }).textContent).not.toContain("Requires a valid prescription");
  });

  it("lists the facts, with customer care, and up to 4 related packs excluding itself", () => {
    const c = view(sacuwin);
    expect(c.querySelector("dl.product-facts")).not.toBeNull();
    expect(within(c).getByText("Customer care", { selector: "dt" })).toBeInTheDocument();
    const related = [...c.querySelectorAll(".related li.pocket")].map((li) => (li as HTMLElement).dataset.slug);
    expect(related.length).toBeLessThanOrEqual(4);
    expect(related).not.toContain("sacuwin-100");
    expect(related).toContain("bemptor-180");
    expect(c.querySelector(".related h2")?.textContent).toBe("More in Heart care");
  });

  it("links back to the category and adds no live region", () => {
    const c = view(sacuwin);
    expect(screen.getByRole("link", { name: /Heart care/ , description: undefined })).toHaveAttribute("href", "/category/cardiology");
    expect(c.querySelector("[aria-live], [role=status]")).toBeNull();
  });

  it("makes no banned claim", () => {
    expect(findClaims(view(sacuwin).textContent ?? "")).toEqual([]);
  });
});
