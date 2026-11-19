import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/fonts", () => ({ fontVariables: "" }));
vi.mock("@/lib/catalogue/cached", () => ({
  getCachedCategories: vi.fn(async () => [
    { slug: "cardiology", name: "Heart care", status: "live", sortOrder: 0 },
    { slug: "urology", name: "Urinary care", status: "coming_soon", sortOrder: 5 },
  ]),
  getCachedProducts: vi.fn(async () => [{ slug: "sacuwin-100" }]),
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

  it("puts the skip link, announcement and header before the page", async () => {
    const { container } = await renderStorePage();
    const order = [
      "a.skip",
      "[data-announce]",
      "header[data-store-head]",
      "main, p:not(.announce-in)",
    ].map((sel) => container.querySelector(sel)!);
    order.forEach((el) => expect(el).not.toBeNull());
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  it("still has exactly one live region", async () => {
    const { container } = await renderStorePage();
    expect(container.querySelectorAll("#live")).toHaveLength(1);
  });
});
