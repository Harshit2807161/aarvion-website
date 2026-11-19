import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BRAND_LOGO_RATIO, BrandMark } from "./brand-mark";

const img = (el: HTMLElement) => el.querySelector("img")!;

describe("BrandMark", () => {
  it("shows the full-colour logo with intrinsic dimensions from the ratio", () => {
    const { container } = render(<BrandMark height={40} className="m" />);
    expect(img(container).getAttribute("src")).toBe("/brand/aarvion-logo.svg");
    expect(img(container).getAttribute("height")).toBe("40");
    expect(img(container).getAttribute("width")).toBe(String(Math.round(40 * BRAND_LOGO_RATIO)));
    expect(img(container).style.aspectRatio).toMatch(/^3( \/ 1)?$/);
    expect(img(container).getAttribute("class")).toBe("m");
  });

  it("uses the reversed logo on forest ground", () => {
    const { container } = render(<BrandMark height={32} variant="reversed" />);
    expect(img(container).getAttribute("src")).toBe("/brand/aarvion-logo-reversed.svg");
  });

  it("names the logo Aarvion by default, and passes alt through", () => {
    const { container, rerender } = render(<BrandMark height={32} />);
    expect(img(container).getAttribute("alt")).toBe("Aarvion");
    rerender(<BrandMark height={32} alt="" />);
    expect(img(container).getAttribute("alt")).toBe("");
    rerender(<BrandMark height={32} alt="Aarvion Pharmaceuticals" />);
    expect(img(container).getAttribute("alt")).toBe("Aarvion Pharmaceuticals");
  });
});
