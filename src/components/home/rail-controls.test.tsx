import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RailControls } from "./rail-controls";

const announce = vi.hoisted(() => vi.fn());
vi.mock("@/components/feedback/live-region", () => ({ announce }));

let observed: (() => void) | null = null;

function setup({ scrollWidth = 1000, clientWidth = 600 } = {}) {
  const view = render(
    <section className="rail" id="heart-care">
      <div className="rail-head">
        <h2 className="h-section">Heart care</h2>
        <div data-rail-controls="">
          <RailControls railId="heart-care" title="Heart care" count={5} />
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

const toggle = () => document.querySelector<HTMLButtonElement>("button.rail-all")!;
const arrows = (c: HTMLElement) => c.querySelector<HTMLElement>(".rail-arrows")!;

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
  announce.mockClear();
});

describe("RailControls", () => {
  it("shows neither control when the strip fits", () => {
    const { container } = setup({ scrollWidth: 600, clientWidth: 600 });
    expect(toggle().hidden).toBe(true);
    expect(arrows(container).hidden).toBe(true);
  });

  it("offers View all 5 and the arrows when the strip overflows, back disabled at the start", () => {
    const { container } = setup();
    expect(toggle().hidden).toBe(false);
    expect(toggle().textContent).toContain("View all 5");
    expect(toggle().textContent).toContain("heart care medicines");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().getAttribute("aria-controls")).toBe("row-heart-care");
    expect(arrows(container).hidden).toBe(false);
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

  it("opens the strip in place, keeps focus on the toggle and announces it", () => {
    const { container, row, rail } = setup();
    toggle().focus();
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().textContent).toContain("Show fewer");
    expect(row.classList.contains("is-grid")).toBe(true);
    expect(rail.classList.contains("is-open")).toBe(true);
    expect(arrows(container).hidden).toBe(true);
    expect(document.activeElement).toBe(toggle());
    expect(announce).toHaveBeenCalledWith("Heart care: all 5 medicines shown");
  });

  it("closes again on the second click and restores everything", () => {
    const { container, row, rail } = setup();
    fireEvent.click(toggle());
    row.scrollLeft = 0;
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().textContent).toContain("View all 5");
    expect(row.classList.contains("is-grid")).toBe(false);
    expect(rail.classList.contains("is-open")).toBe(false);
    expect(arrows(container).hidden).toBe(false);
    expect(announce).toHaveBeenLastCalledWith("Showing one row");
  });

  it("scrolls the rail into view when it closes with its head above the viewport", () => {
    const { rail } = setup();
    const into = vi.fn();
    rail.scrollIntoView = into;
    rail.getBoundingClientRect = () => ({ top: -300 }) as DOMRect;
    fireEvent.click(toggle());
    expect(into).not.toHaveBeenCalled();
    fireEvent.click(toggle());
    expect(into).toHaveBeenCalledWith({ block: "start" });
  });

  it("keeps the toggle while open even though a sheet no longer overflows", () => {
    const { row } = setup();
    fireEvent.click(toggle());
    Object.defineProperty(row, "scrollWidth", { configurable: true, value: 600 });
    act(() => observed?.());
    expect(toggle().hidden).toBe(false);
  });
});
