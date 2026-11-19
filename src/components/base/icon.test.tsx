import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark, Icon, type IconName } from "./icon";

describe("Icon", () => {
  it("renders a decorative 24-unit svg with a path", () => {
    const { container } = render(<Icon name="cart" />);
    const svg = container.querySelector("svg.i");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.querySelector("path")).not.toBeNull();
  });

  it("sizes the svg and merges className", () => {
    const { container } = render(<Icon name="check" size={28} className="extra" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("28");
    expect(svg.getAttribute("height")).toBe("28");
    expect(svg.getAttribute("class")).toContain("extra");
  });

  it("defaults to 20px", () => {
    const { container } = render(<Icon name="search" />);
    expect(container.querySelector("svg")!.getAttribute("width")).toBe("20");
  });

  it("draws every named symbol", () => {
    const names: IconName[] = ["search", "upload", "cart", "user", "arrow", "back", "go", "plus", "minus", "check", "chev", "hold", "play", "file", "box", "chat", "shield", "pharm", "truck", "cash", "menu", "close", "alert", "info", "phone", "mail", "clock"];
    for (const name of names) {
      const { container } = render(<Icon name={name} />);
      expect(container.querySelector("svg path, svg circle, svg rect"), name).not.toBeNull();
    }
  });

  it("rejects unknown names at compile time", () => {
    // @ts-expect-error "nope" is not an IconName
    render(<Icon name="nope" />);
  });
});

describe("BrandMark", () => {
  it("uses the 360x96 swoosh box", () => {
    const { container } = render(<BrandMark className="m" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 360 96");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });
});
