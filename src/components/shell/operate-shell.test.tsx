import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OperateShell } from "./operate-shell";

describe("OperateShell", () => {
  it("renders main#main.operate with the forest band, then the work sheet", () => {
    const { container } = render(<OperateShell title="Your cart">body</OperateShell>);
    const main = container.querySelector("main#main.operate")!;
    expect([...main.children].map((c) => c.className.split(" ")[0])).toEqual(["band", "work"]);
    expect(main.querySelector("section.band")?.getAttribute("data-ground")).toBe("forest");
  });

  it("puts the title as the h1 inside the band, with the sub line", () => {
    const { container } = render(
      <OperateShell title="Your cart" sub="Check your packs.">
        x
      </OperateShell>,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Your cart" });
    expect(h1.closest(".band")).not.toBeNull();
    expect(container.querySelector(".band-sub")?.textContent).toBe("Check your packs.");
  });

  it("renders the back link in the band", () => {
    render(
      <OperateShell title="T" back={{ href: "/#medicines", label: "Continue shopping" }}>
        x
      </OperateShell>,
    );
    const back = screen.getByRole("link", { name: "Continue shopping" });
    expect(back.getAttribute("href")).toBe("/#medicines");
    expect(back.closest(".band")).not.toBeNull();
    expect(back.className).toContain("band-back");
  });

  it("omits the optional parts when not given", () => {
    const { container } = render(<OperateShell>x</OperateShell>);
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector(".band-sub")).toBeNull();
    expect(container.querySelector(".band-back")).toBeNull();
  });

  it("puts children inside .work .work-in", () => {
    const { container } = render(
      <OperateShell title="T">
        <p data-testid="kid">hello</p>
      </OperateShell>,
    );
    expect(container.querySelector(".work > .work-in [data-testid=kid]")).not.toBeNull();
  });
});
