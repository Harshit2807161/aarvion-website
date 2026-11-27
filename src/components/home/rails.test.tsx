import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { findClaims } from "../../../tests/helpers/claims";
import { ROUTES } from "@/config/routes";
import { homeModel } from "@/lib/catalogue/home-model";
import { CATEGORY_LIST } from "@/server/catalogue/categories";
import { Rails } from "./rails";

const products = publicCatalogue();

function setup(list = products) {
  const { container } = render(<Rails model={homeModel(list, CATEGORY_LIST)} />);
  return container;
}

describe("Rails", () => {
  it("is the #medicines block of three rails, each titled by its heading", () => {
    const c = setup();
    expect(c.querySelector("div.meds.wrap#medicines")).not.toBeNull();
    const rails = [...c.querySelectorAll("section.rail")];
    expect(rails.map((r) => r.id)).toEqual(["heart-care", "eye-care", "diabetes-care"]);
    expect(rails.map((r) => r.getAttribute("aria-labelledby"))).toEqual([
      "rail-heart-care",
      "rail-eye-care",
      "rail-diabetes-care",
    ]);
    expect(rails.map((r) => r.querySelector("h2.h-section")?.textContent)).toEqual([
      "Heart care",
      "Eye care",
      "Diabetes and respiratory care",
    ]);
    expect(rails.map((r) => r.querySelector("h2")?.id)).toEqual([
      "rail-heart-care",
      "rail-eye-care",
      "rail-diabetes-care",
    ]);
  });

  it("marks each rail for the scroll film and gives it its rise", () => {
    const rails = [...setup().querySelectorAll("section.rail")] as HTMLElement[];
    expect(rails.map((r) => r.dataset.act)).toEqual(["pass", "pass", "pass"]);
    expect(rails.map((r) => r.getAttribute("data-in"))).toEqual([
      "0 .4 out",
      "0 .4 out",
      "0 .4 out",
    ]);
    expect(rails.map((r) => r.style.getPropertyValue("--rise"))).toEqual(["80px", "110px", "90px"]);
  });

  it("lists the heart pockets in shelf order, 11 in all, each pocket row sized by --n", () => {
    const c = setup();
    const heart = c.querySelector("#heart-care")!;
    expect([...heart.querySelectorAll("li.pocket")].map((li) => li.id)).toEqual([
      "p-sacuwin-50",
      "p-sacuwin-100",
      "p-sacuwin-200",
      "p-bemptor-180",
      "p-bemptor-r40",
    ]);
    expect(c.querySelectorAll("li.pocket")).toHaveLength(11);
    const row = heart.querySelector(".rail-body > .rail-strip > ul.rail-row") as HTMLElement;
    expect(row.id).toBe("row-heart-care");
    expect(row.style.getPropertyValue("--n")).toBe("5");
    expect(heart.querySelector("li.pocket h3.pocket-name")).not.toBeNull();
  });

  it("counts the medicines; View all links to each single-category rail, not the shared one", () => {
    const rails = [...setup().querySelectorAll("section.rail")];
    expect(rails.map((r) => r.querySelector("p.rail-count")?.textContent)).toEqual([
      "5 medicines",
      "4 medicines",
      "2 medicines",
    ]);
    expect(rails.every((r) => r.querySelector(".rail-head > [data-rail-controls]"))).toBe(true);
    expect(rails.map((r) => r.querySelector("a.rail-all")?.getAttribute("href") ?? null)).toEqual([
      "/category/cardiology",
      "/category/ophthalmology",
      null,
    ]);
  });

  it("keeps an anchor for the second category on the shared rail", () => {
    const c = setup();
    const anchor = c.querySelector("section#diabetes-care > span.anchor#respiratory-care");
    expect(anchor?.childElementCount).toBe(0);
    expect(c.querySelectorAll("#respiratory-care")).toHaveLength(1);
    expect(c.querySelectorAll("span.anchor")).toHaveLength(1);
  });

  it("puts the aside beside the shared rail only", () => {
    const c = setup();
    expect(c.querySelectorAll("aside.rail-aside")).toHaveLength(1);
    const aside = c.querySelector("#diabetes-care .rail-body > aside.rail-aside")!;
    expect(aside.querySelector("h3")?.textContent).toBe("Looking for another Aarvion medicine?");
    expect(aside.querySelector("p")?.textContent).toBe(
      "More of Aarvion’s medicines are being added to the store. Search by brand or salt, or get in touch.",
    );
    const search = aside.querySelector("a[data-search]");
    expect(search?.textContent).toBe("Search medicines");
    expect(search?.getAttribute("href")).toBe("#q");
    expect(search?.querySelector("svg.i")).not.toBeNull(); // the prototype's search icon
    expect(search?.className).toContain("btn-forest");
    const contact = aside.querySelector(`a[href="${ROUTES.contact}"]`);
    expect(contact?.textContent).toBe("Contact us");
    expect(contact?.className).toContain("btn-quiet");
  });

  it("loads every pocket image lazily", () => {
    const imgs = [...setup().querySelectorAll("li.pocket img")];
    expect(imgs).toHaveLength(11);
    for (const img of imgs) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("fetchpriority")).toBeNull();
    }
  });

  it("states the prescription note when every medicine needs one", () => {
    const note = setup().querySelector("p.meds-note");
    expect(note?.textContent).toBe(
      "All 11 medicines need a valid prescription. Each price is the MRP printed on the pack, less ₹20.",
    );
  });

  it("drops the note when one medicine needs no prescription", () => {
    const otc = products.map((p, i) => (i === 0 ? { ...p, rxRequired: false } : p));
    expect(setup(otc).querySelector(".meds-note")).toBeNull();
  });

  it("makes no claim the copy rules forbid", () => {
    const c = setup();
    expect(findClaims(c.textContent ?? "", { allRx: true })).toEqual([]);
  });
});
