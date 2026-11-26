import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { findClaims } from "../../../tests/helpers/claims";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { CategoryView } from "./category-view";

const catalogue = publicCatalogue();
const live = CATEGORY_LIST.filter((c) => c.status === "live");
const category = (slug: string) => CATEGORY_LIST.find((c) => c.slug === slug)!;

function setup(slug: string) {
  const c = category(slug);
  const products = c.status === "live" ? catalogue.filter((p) => p.category === slug) : [];
  const others = live.filter((o) => o.slug !== slug);
  return render(<CategoryView category={c} products={products} others={others} />).container;
}

describe("CategoryView, a live category", () => {
  it("shows the shopper name, the count and the price rule in the band", () => {
    const c = setup("cardiology");
    expect(c.querySelector("h1")?.textContent).toBe("Heart care");
    expect(c.querySelector(".band-sub")?.textContent).toBe(
      "Five medicines. Each price is the MRP printed on the pack, less ₹20.",
    );
    expect(c.querySelector("a.band-back")).toHaveAttribute("href", "/#medicines");
    expect(c.querySelector("a.band-back")?.textContent).toBe("All medicines");
  });

  it("lists the pockets in shelf order, h2 names, only the first with priority", () => {
    const c = setup("cardiology");
    const pockets = [...c.querySelectorAll("ul.cat-grid > li.pocket")];
    expect(pockets.map((p) => p.id)).toEqual([
      "p-sacuwin-50",
      "p-sacuwin-100",
      "p-sacuwin-200",
      "p-bemptor-180",
      "p-bemptor-r40",
    ]);
    expect(pockets[0]!.querySelector("h2.pocket-name")).not.toBeNull();
    const imgs = pockets.map((p) => p.querySelector("img")!);
    expect(imgs[0]).toHaveAttribute("loading", "eager");
    expect(imgs[0]).toHaveAttribute("fetchpriority", "high");
    for (const img of imgs.slice(1)) {
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).not.toHaveAttribute("fetchpriority");
    }
  });

  it("links to the other live categories only", () => {
    const c = setup("cardiology");
    const links = [...c.querySelectorAll("nav.cat-others a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/category/diabetology",
      "/category/ophthalmology",
      "/category/respiratory",
    ]);
  });

  it("says one medicine, not 'One medicines'", () => {
    const one = catalogue.filter((p) => p.category === "cardiology").slice(0, 1);
    const c = render(
      <CategoryView category={category("cardiology")} products={one} others={[]} />,
    ).container;
    expect(c.querySelector(".band-sub")?.textContent).toMatch(/^One medicine\. /);
  });
});

describe("CategoryView, a coming-soon category", () => {
  it("shows Coming soon, no pockets and the browse link", () => {
    const c = setup("urology");
    expect(c.querySelector("h1")?.textContent).toBe("Urinary care");
    expect(c.querySelector(".band-sub")?.textContent).toBe("Coming soon");
    expect(c.querySelector(".pocket")).toBeNull();
    const panel = c.querySelector(".cat-soon")!;
    expect(panel.textContent).toContain(
      "We’re adding Urinary care medicines to the store. Until then, browse the medicines available now.",
    );
    const link = panel.querySelector("a")!;
    expect(link).toHaveAttribute("href", "/#medicines");
    expect(link.textContent).toBe("Browse medicines");
  });
});

describe("CategoryView wording", () => {
  it("makes no banned claim and never says therapy", () => {
    for (const slug of ["cardiology", "ophthalmology", "urology"]) {
      const text = setup(slug).textContent ?? "";
      expect(findClaims(text)).toEqual([]);
      expect(text).not.toMatch(/therap/i);
    }
  });
});
