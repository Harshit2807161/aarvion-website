import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/fonts", () => ({ fontVariables: "" }));
vi.mock("@/lib/catalogue/cached", () => ({
  getCachedCategories: vi.fn(async () => [
    { slug: "cardiology", name: "Heart care", status: "live", sortOrder: 0 },
    { slug: "urology", name: "Urinary care", status: "coming_soon", sortOrder: 5 },
  ]),
}));

import RootLayout from "../layout";
import StoreLayout from "./layout";

/** What the browser body holds for a page: the root layout around the store layout. */
async function renderStorePage() {
  const page = await StoreLayout({ children: <p>page</p> });
  const html = RootLayout({ children: page }) as ReactElement<{ children: ReactElement }>;
  const body = html.props.children as ReactElement<{ children: ReactNode }>;
  return render(<>{body.props.children}</>);
}

describe("store layout", () => {
  it("renders the page, then the footer with only the live categories", async () => {
    const { container } = await renderStorePage();
    const footer = container.querySelector("footer#contact")!;
    expect(footer).not.toBeNull();
    expect(container.textContent).toContain("page");
    expect(footer.textContent).toContain("Heart care");
    expect(footer.textContent).not.toContain("Urinary care");
    expect(container.querySelector("p")?.compareDocumentPosition(footer)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("puts the announcement line before the page", async () => {
    const { container } = await renderStorePage();
    const bar = container.querySelector("[data-announce]")!;
    expect(bar).not.toBeNull();
    expect(bar.compareDocumentPosition(container.querySelector("p:not(.announce-in)")!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("still has exactly one live region", async () => {
    const { container } = await renderStorePage();
    expect(container.querySelectorAll("#live")).toHaveLength(1);
  });
});
