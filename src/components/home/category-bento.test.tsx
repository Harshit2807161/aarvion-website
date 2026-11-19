import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { findClaims } from "../../../tests/helpers/claims";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { ROUTES } from "@/config/routes";
import { homeModel } from "@/lib/catalogue/home-model";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { CategoryBento } from "./category-bento";

function setup() {
  return render(<CategoryBento model={homeModel(publicCatalogue(), CATEGORY_LIST)} />).container;
}

describe("CategoryBento (static composition, C3)", () => {
  it("is the pass act labelled by its Shop by category heading", () => {
    const c = setup();
    const act = c.querySelector("section#areas.act.areas");
    expect(act?.getAttribute("data-act")).toBe("pass");
    expect(act?.getAttribute("aria-labelledby")).toBe("areas-title");
    expect(c.querySelector("h2.h-section#areas-title")?.textContent).toBe("Shop by category");
  });

  it("overrides Tailwind's h-section height utility so the heading keeps its own height", () => {
    expect(setup().querySelector("#areas-title")?.classList.contains("h-auto!")).toBe(true);
  });

  it("links the tiles in order to their category pages", () => {
    const tiles = [...setup().querySelectorAll("a.tile")];
    expect(tiles.map((a) => a.querySelector(".tile-name")?.textContent)).toEqual([
      "Heart care",
      "Eye care",
      "Diabetes care",
      "Respiratory care",
    ]);
    expect(tiles.map((a) => a.getAttribute("href"))).toEqual([
      ROUTES.category("cardiology"),
      ROUTES.category("ophthalmology"),
      ROUTES.category("diabetology"),
      ROUTES.category("respiratory"),
    ]);
    expect(tiles.map((a) => a.className)).toEqual([
      "tile tile-cardio",
      "tile tile-eye",
      "tile tile-diab",
      "tile tile-resp",
    ]);
  });

  it("counts the medicines from the data and lists them", () => {
    const tiles = [...setup().querySelectorAll("a.tile")];
    expect(tiles.map((a) => a.querySelector(".tile-count")?.textContent)).toEqual([
      "5 medicines",
      "4 medicines",
      "1 medicine",
      "1 medicine",
    ]);
    expect(tiles[0]!.querySelector(".tile-list")?.textContent).toBe(
      "Sacuwin 50, 100 and 200, Bemptor-180, Bemptor-R40",
    );
  });

  it("draws the art as decorative images, in layout order", () => {
    const art = setup().querySelector("a.tile-cardio .tile-art");
    expect(art?.getAttribute("aria-hidden")).toBe("true");
    const imgs = [...art!.querySelectorAll("img.ta")];
    expect(imgs.map((i) => i.className)).toEqual(["ta ta-1", "ta ta-2", "ta ta-3"]);
    expect(imgs.every((i) => i.getAttribute("alt") === "")).toBe(true);
  });

  it("has the arrow glyph on every link tile", () => {
    expect(setup().querySelectorAll("a.tile .tile-go svg").length).toBe(4);
  });

  it("carries the film ranges the engine reads", () => {
    const c = setup();
    expect([...c.querySelectorAll("a.tile")].map((a) => a.getAttribute("data-in"))).toEqual([
      ".02 .25 out",
      ".06 .29 out",
      ".1 .32 out",
      ".13 .35 out",
    ]);
    expect(c.querySelector(".tile-soon")?.getAttribute("data-in")).toBe(".16 .37 out");
  });

  it("lists the coming-soon categories in a non-link tile", () => {
    const soon = setup().querySelector(".tile-soon");
    expect(soon?.tagName).toBe("DIV");
    expect(soon?.querySelector(".tile-count")?.textContent).toBe("Coming soon");
    expect([...soon!.querySelectorAll("li")].map((l) => l.textContent)).toEqual([
      "Digestive care",
      "Bone and joint care",
      "Urinary care",
    ]);
  });

  it("makes no invented claims and never says therapy", () => {
    const text = setup().textContent ?? "";
    expect(findClaims(text)).toEqual([]);
    expect(text).not.toMatch(/therapy/i);
  });
});
