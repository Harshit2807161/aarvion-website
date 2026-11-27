import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Category } from "@/server/catalogue/schema";
import { mockPathname } from "../../../tests/helpers/navigation-mocks";
import { CategoryBar } from "./category-bar";

const categories: Category[] = [
  { slug: "cardiology", name: "Heart care", status: "live", sortOrder: 0 },
  { slug: "diabetology", name: "Diabetes care", status: "live", sortOrder: 0 },
  { slug: "ophthalmology", name: "Eye care", status: "live", sortOrder: 0 },
  { slug: "respiratory", name: "Respiratory care", status: "live", sortOrder: 0 },
];

describe("CategoryBar", () => {
  it("is the Shop by category landmark with a list inside the wrap", () => {
    const { container } = render(<CategoryBar categories={categories} />);
    const nav = screen.getByRole("navigation", { name: "Shop by category" });
    expect(nav).toHaveClass("catbar");
    expect(container.querySelector("nav.catbar > ul.wrap.catbar-in")).not.toBeNull();
  });

  it("links each live category in order, then All medicines", () => {
    render(<CategoryBar categories={categories} />);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([
      "Heart care",
      "Diabetes care",
      "Eye care",
      "Respiratory care",
      "All medicines",
    ]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/category/cardiology",
      "/category/diabetology",
      "/category/ophthalmology",
      "/category/respiratory",
      "/#medicines",
    ]);
  });

  it("puts the go chevron on All medicines only, hidden from assistive tech", () => {
    const { container } = render(<CategoryBar categories={categories} />);
    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: "All medicines" }).contains(icons[0]!)).toBe(true);
  });

  it("does not render a coming-soon category", () => {
    render(
      <CategoryBar
        categories={[
          ...categories,
          { slug: "urology", name: "Urinary care", status: "coming_soon", sortOrder: 5 },
        ]}
      />,
    );
    expect(screen.queryByText("Urinary care")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });
});

describe("CategoryBar current page", () => {
  it("marks only the link for the current category page with aria-current=page", () => {
    mockPathname.value = "/category/ophthalmology";
    render(<CategoryBar categories={categories} />);
    const current = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual(["Eye care"]);
  });

  it("marks nothing off a category page", () => {
    mockPathname.value = "/";
    const { container } = render(<CategoryBar categories={categories} />);
    expect(container.querySelector("[aria-current]")).toBeNull();
  });
});
