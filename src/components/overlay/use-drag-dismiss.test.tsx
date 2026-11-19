import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDragDismiss } from "./use-drag-dismiss";

let reduced = false;
const onDismiss = vi.fn();

function Sheet({ state = "open" }: { state?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const grab = useDragDismiss({ panelRef: panel, onDismiss });
  return (
    <div ref={panel} data-testid="panel" data-state={state}>
      <div data-testid="head" {...grab}>
        <button type="button">Close</button>
      </div>
    </div>
  );
}

/** happy-dom's TransitionEvent ignores the init dict, so set propertyName by hand. */
function endTransition(el: Element, propertyName: string) {
  const e = new Event("transitionend", { bubbles: true });
  Object.defineProperty(e, "propertyName", { value: propertyName });
  act(() => {
    el.dispatchEvent(e);
  });
}

const panel = () => screen.getByTestId("panel");
const head = () => screen.getByTestId("head");
const down = (y = 0, pointerId = 1) =>
  fireEvent.pointerDown(head(), { pointerId, button: 0, clientY: y });
const move = (y: number, pointerId = 1) => fireEvent.pointerMove(head(), { pointerId, clientY: y });
const up = (y: number, pointerId = 1) => fireEvent.pointerUp(head(), { pointerId, clientY: y });

beforeEach(() => {
  reduced = false;
  onDismiss.mockClear();
  vi.useFakeTimers({ toFake: ["performance", "setTimeout", "requestAnimationFrame"] });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width") || (query.includes("reduced-motion") && reduced),
    media: query,
  }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    height: 600,
  } as DOMRect);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useDragDismiss class lifecycle", () => {
  it("under the thresholds: snaps back, clears the transition on transitionend and never re-arms the open animation", () => {
    render(<Sheet />);
    down();
    expect(panel().classList.contains("is-dragging")).toBe(true);
    move(100);
    expect(panel().style.transform).toBe("translateY(100px)");
    vi.advanceTimersByTime(1000);
    up(100);
    expect(onDismiss).not.toHaveBeenCalled();
    // Dropping the class here would restart the entrance animation.
    expect(panel().classList.contains("is-dragging")).toBe(true);
    expect(panel().style.transform).toBe("");
    expect(panel().style.transition).toContain("transform");
    endTransition(panel(), "transform");
    // Only the inline transition is cleared: the class holds the open animation off.
    expect(panel().classList.contains("is-dragging")).toBe(true);
    expect(panel().style.transition).toBe("");
  });

  it("settles on the fallback timer when no transitionend arrives", () => {
    render(<Sheet />);
    down();
    move(100);
    vi.advanceTimersByTime(1000);
    up(100);
    vi.advanceTimersByTime(300);
    expect(panel().style.transition).toBe("");
    expect(panel().classList.contains("is-dragging")).toBe(true);
  });

  it("over the thresholds: dismisses, and leaves is-dragging and the offset for the close animation", () => {
    render(<Sheet />);
    down();
    move(200);
    vi.advanceTimersByTime(500);
    up(200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(panel().classList.contains("is-dragging")).toBe(true);
    expect(panel().style.transform).toBe("translateY(200px)");
  });

  it("pointercancel snaps back and never dismisses", () => {
    render(<Sheet />);
    down();
    move(400);
    fireEvent.pointerCancel(head(), { pointerId: 1, clientY: 400 });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(panel().style.transform).toBe("");
    expect(panel().classList.contains("is-dragging")).toBe(true);
    endTransition(panel(), "transform");
    expect(panel().classList.contains("is-dragging")).toBe(true);
  });

  it("ignores transitionend from another property or element", () => {
    render(<Sheet />);
    down();
    move(100);
    vi.advanceTimersByTime(1000);
    up(100);
    endTransition(panel(), "opacity");
    expect(panel().style.transition).toContain("transform");
    endTransition(screen.getByRole("button", { name: "Close" }), "transform");
    expect(panel().style.transition).toContain("transform");
  });

  it("a plain tap on the grip leaves is-dragging on, so the entrance cannot replay", () => {
    render(<Sheet />);
    down();
    vi.advanceTimersByTime(50);
    up(0);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(panel().classList.contains("is-dragging")).toBe(true);
  });

  it("snaps back when onDismiss did not close the sheet", () => {
    render(<Sheet />);
    down();
    move(300);
    vi.advanceTimersByTime(500);
    up(300);
    expect(panel().style.transform).toBe("translateY(300px)");
    vi.advanceTimersByTime(50);
    expect(panel().style.transform).toBe("");
  });

  it("does not snap back once the sheet is closing", () => {
    const { rerender } = render(<Sheet />);
    down();
    move(300);
    vi.advanceTimersByTime(500);
    up(300);
    rerender(<Sheet state="closed" />);
    vi.advanceTimersByTime(50);
    expect(panel().style.transform).toBe("translateY(300px)");
  });

  it("skips the snap-back transition under reduced motion", () => {
    reduced = true;
    render(<Sheet />);
    down();
    move(100);
    vi.advanceTimersByTime(1000);
    up(100);
    expect(panel().style.transition).toBe("");
    expect(panel().style.transform).toBe("");
    expect(panel().classList.contains("is-dragging")).toBe(true);
  });
});

describe("useDragDismiss pointers", () => {
  it("ignores a second pointer while one is dragging", () => {
    render(<Sheet />);
    down(0, 1);
    down(50, 2);
    move(120, 2);
    expect(panel().style.transform).toBe("");
    move(80, 1);
    expect(panel().style.transform).toBe("translateY(80px)");
  });

  it("ignores pointers that start on a button", () => {
    render(<Sheet />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Close" }), {
      pointerId: 1,
      button: 0,
      clientY: 0,
    });
    expect(panel().classList.contains("is-dragging")).toBe(false);
  });
});
