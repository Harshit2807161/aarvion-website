import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { findClaims } from "../../../tests/helpers/claims";
import { Pocket } from "./pocket";

const NB = " ";
const catalogue = publicCatalogue();
const sacuwin100 = catalogue.find((p) => p.slug === "sacuwin-100")!;

function renderPocket(props: Partial<Parameters<typeof Pocket>[0]> = {}) {
  const { container } = render(
    <ul>
      <Pocket product={sacuwin100} {...props} />
    </ul>,
  );
  return container.querySelector<HTMLLIElement>("li.pocket")!;
}
const img = (li: HTMLElement) => li.querySelector<HTMLImageElement>(".blister > img.pocket-img")!;

describe("Pocket", () => {
  it("renders the v2 pocket for Sacuwin 100", () => {
    const li = renderPocket();
    expect(li.id).toBe("p-sacuwin-100");
    expect(li.dataset.slug).toBe("sacuwin-100");
    expect(li.dataset.name).toBe("Sacuwin 100");
    expect(li.querySelector(":scope > .pocket-in > .blister")).not.toBeNull();
    expect(li.querySelector(":scope > .pocket-in > .pocket-body")).not.toBeNull();

    const h3 = screen.getByRole("heading", { level: 3 });
    expect(h3).toHaveClass("pocket-name");
    expect(h3.querySelector("span")?.textContent).toBe("Sacuwin 100");
    expect(h3.querySelector("abbr.rx")).toHaveAttribute("title", "Prescription required");
  });

  it("links the name to the product page, with the Rx badge outside the link", () => {
    const li = renderPocket();
    const link = li.querySelector<HTMLAnchorElement>("a.pocket-link")!;
    expect(link).toHaveAttribute("href", "/product/sacuwin-100");
    expect(link.textContent).toBe("Sacuwin 100");
    expect(link.querySelector("abbr.rx")).toBeNull();
    expect(li.querySelector(".pocket-name > abbr.rx")).not.toBeNull();
  });

  it("shows the actives with whole strengths, the full composition in the title and for AT", () => {
    const salt = renderPocket().querySelector<HTMLElement>(".pocket-salt")!;
    const full = "Sacubitril (as sodium) 49 mg + Valsartan 51 mg";
    expect(salt).toHaveAttribute("title", full);
    const shown = salt.querySelector<HTMLElement>('span[aria-hidden="true"]')!;
    expect([...shown.querySelectorAll(".str")].map((s) => s.textContent)).toEqual([
      `49${NB}mg`,
      `51${NB}mg`,
    ]);
    expect(shown.textContent).toBe(`Sacubitril 49${NB}mg + Valsartan 51${NB}mg`);
    expect(salt.querySelector(".sr-only")?.textContent).toBe(full);
  });

  it("shows the pack, the stamp with % off, and Add to cart", () => {
    const li = renderPocket();
    expect(li.querySelector(".pocket-pack")?.textContent).toBe(`Strip of 14${NB}tablets`);
    const foot = li.querySelector(".pocket-foot")!;
    expect(foot.querySelector(".stamp-mrp .dm")?.textContent).toBe("MRP ₹407");
    expect(foot.querySelector(".off")?.textContent).toContain("4% off");
    expect(foot.querySelector(".stamp-price .dm")?.textContent).toBe("₹387");
    expect(foot.querySelector(".cart-ctl")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Add Sacuwin 100 to cart" })).toBeInTheDocument();
  });

  it("never shows 0% off", () => {
    const li = renderPocket({ product: { ...sacuwin100, mrpPaise: 250000 } });
    expect(li.querySelector(".off")).toBeNull();
    expect(li.textContent).not.toContain("0% off");
  });

  it("adds no live region of its own: cart changes are spoken only by #live", () => {
    const li = renderPocket();
    expect(li.querySelector("[aria-live], [role=status], output")).toBeNull();
  });

  it("shows the cutout, lazy, with its dimensions and the pocket sizes", () => {
    const image = img(renderPocket());
    expect(image).toHaveAttribute("alt", "Sacuwin 100 pack");
    expect(image).toHaveAttribute("width", String(sacuwin100.cutout!.width));
    expect(image).toHaveAttribute("height", String(sacuwin100.cutout!.height));
    expect(image).toHaveAttribute("sizes", "(max-width: 719px) 40vw, 200px");
    expect(image.getAttribute("src")).toContain(encodeURIComponent(sacuwin100.cutout!.src));
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).not.toHaveAttribute("fetchpriority");
  });

  it("loads eagerly at high priority when it is the LCP candidate, without a preload [C24]", () => {
    const image = img(renderPocket({ priority: true }));
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(document.querySelector('link[rel="preload"]')).toBeNull();
  });

  it("falls back to the first photo when there is no cutout", () => {
    const image = img(renderPocket({ product: { ...sacuwin100, cutout: null } }));
    expect(image).toHaveAttribute("alt", sacuwin100.images[0]!.alt);
    expect(image).toHaveAttribute("width", String(sacuwin100.images[0]!.width));
  });

  it("drops the Rx badge for a product that needs no prescription", () => {
    const li = renderPocket({ product: { ...sacuwin100, rxRequired: false } });
    expect(li.querySelector("abbr")).toBeNull();
  });

  it("takes the heading level from its section", () => {
    renderPocket({ heading: "h2" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveClass("pocket-name");
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });

  it.each(catalogue.map((p) => [p.slug, p]))("%s makes no invented claim", (_slug, product) => {
    const li = renderPocket({ product });
    const labels = [...li.querySelectorAll("[aria-label], [title], img[alt]")].map((el) =>
      ["aria-label", "title", "alt"].map((a) => el.getAttribute(a) ?? "").join(" "),
    );
    expect(findClaims([li.textContent, ...labels].join("\n"))).toEqual([]);
    for (const str of li.querySelectorAll(".str")) expect(str.textContent).not.toContain(" ");
  });
});
