import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Icon } from "@/components/base/icon";
import { RailControls } from "./rail-controls";

let observed: (() => void) | null = null;

function setup({
  scrollWidth = 1000,
  clientWidth = 600,
  slug = "cardiology" as string | null,
} = {}) {
  const view = render(
    <section className="rail" id="heart-care">
      <div className="rail-head">
        <h2 className="h-section">Heart care</h2>
        <div data-rail-controls="">
          <RailControls railId="heart-care" title="Heart care" count={5} slug={slug ?? undefined} />
        </div>
      </div>
      <ul className="rail-row" id="row-heart-care" />
    </section>,
  );
  const row = view.container.querySelector<HTMLElement>(".rail-row")!;
  const scrollBy = vi.fn();
  Object.defineProperties(row, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
  });
  row.scrollBy = scrollBy;
  act(() => observed?.());
  return { ...view, row, scrollBy, rail: view.container.querySelector(".rail")! };
}

const viewAll = () => document.querySelector<HTMLAnchorElement>("a.rail-all");
const arrows = (c: HTMLElement) => c.querySelector<HTMLElement>(".rail-arrows")!;
const off = (c: HTMLElement) => arrows(c).hasAttribute("data-off");

beforeEach(() => {
  observed = null;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        observed = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RailControls", () => {
  it("hides the arrows when the strip fits, but keeps the View all link", () => {
    const { container } = setup({ scrollWidth: 600, clientWidth: 600 });
    expect(off(container)).toBe(true);
    expect(viewAll()).not.toBeNull();
  });

  it("links View all 5 to the category page, always visible", () => {
    setup();
    expect(viewAll()!.getAttribute("href")).toBe("/category/cardiology");
    expect(viewAll()!.textContent).toContain("View all 5");
    expect(viewAll()!.textContent).toContain("heart care medicines");
    expect(viewAll()!.hasAttribute("aria-expanded")).toBe(false);
    // A link to another page points forward, not down like a disclosure chevron.
    const { container: arrow } = render(<Icon name="arrow" />);
    expect(viewAll()!.querySelector("svg path")?.getAttribute("d")).toBe(
      arrow.querySelector("svg path")?.getAttribute("d"),
    );
  });

  it("shows no View all on the shared rail (no slug), only the arrows", () => {
    setup({ slug: null });
    expect(viewAll()).toBeNull();
    expect(screen.getByRole("button", { name: "Scroll Heart care forward" })).toBeInTheDocument();
  });

  it("offers the arrows when the strip overflows, back disabled at the start", () => {
    const { container } = setup();
    expect(off(container)).toBe(false);
    const back = screen.getByRole("button", { name: "Scroll Heart care back" });
    const fwd = screen.getByRole("button", { name: "Scroll Heart care forward" });
    expect(back.getAttribute("aria-disabled")).toBe("true");
    expect(fwd.getAttribute("aria-disabled")).toBe("false");
  });

  it("pages forward by 80% of the row, smoothly unless motion is reduced", () => {
    const { scrollBy } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Scroll Heart care forward" }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 480, behavior: "smooth" });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    fireEvent.click(screen.getByRole("button", { name: "Scroll Heart care forward" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 480, behavior: "auto" });
  });

  it("ignores a click on a disabled arrow", () => {
    const { scrollBy } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Scroll Heart care back" }));
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("enables back and disables forward after the row settles at the end", () => {
    vi.useFakeTimers();
    try {
      const { row } = setup();
      row.scrollLeft = 400;
      fireEvent.scroll(row);
      act(() => {
        vi.advanceTimersByTime(80);
      });
      expect(
        screen
          .getByRole("button", { name: "Scroll Heart care back" })
          .getAttribute("aria-disabled"),
      ).toBe("false");
      expect(
        screen
          .getByRole("button", { name: "Scroll Heart care forward" })
          .getAttribute("aria-disabled"),
      ).toBe("true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes its listener and observer on unmount", () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect = disconnect;
      },
    );
    const { row, unmount } = setup();
    const remove = vi.spyOn(row, "removeEventListener");
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(disconnect).toHaveBeenCalled();
  });
});
