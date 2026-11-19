import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ICON_NAMES, Icon } from "./icon";

const read = (p: string) => readFileSync(path.resolve(import.meta.dirname, "../../..", p), "utf8");

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

  it("sets the rendered size through --i-size, which base.css reads", () => {
    const { container } = render(<Icon name="check" size={28} />);
    expect(container.querySelector("svg")!.style.getPropertyValue("--i-size")).toBe("28px");
    expect(
      render(<Icon name="search" />)
        .container.querySelector("svg")!
        .getAttribute("width"),
    ).toBe("20");
    expect(read("src/styles/base.css")).toMatch(
      /\.i \{[^}]*width: var\(--i-size, 20px\);[^}]*height: var\(--i-size, 20px\);/,
    );
  });

  it("draws every symbol exactly as the prototype sprite does", () => {
    const sprite =
      read("design/prototype/src/index.src.html") + read("design/prototype/pages/login.html");
    expect(ICON_NAMES).toHaveLength(27);
    for (const name of ICON_NAMES) {
      const m = sprite.match(
        new RegExp(`<symbol id="i-${name}" viewBox="0 0 24 24">(.*?)</symbol>`),
      );
      expect(m, `${name} is in the prototype sprite`).not.toBeNull();
      const holder = document.createElement("div");
      holder.innerHTML = `<svg>${m![1]!}</svg>`;
      const expected = holder.querySelector("svg")!;
      const { container } = render(<Icon name={name} />);
      expect(container.querySelector("svg")!.innerHTML, name).toBe(expected.innerHTML);
    }
  });

  it("rejects unknown names at compile time", () => {
    // @ts-expect-error "nope" is not an IconName
    render(<Icon name="nope" />);
  });
});
