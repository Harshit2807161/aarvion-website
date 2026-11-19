import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveRegion, announce } from "./live-region";
import { TOAST_LEAVE_MS, TOAST_MS, TOAST_RESUME_MS, Toaster, dismissToast, toast } from "./toast";

function setup() {
  return render(
    <>
      <Toaster />
      <LiveRegion />
    </>,
  );
}

const toastEl = () => document.querySelector<HTMLElement>(".toast");
const live = () => document.getElementById("live")!;
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => dismissToast());
  tick(TOAST_LEAVE_MS + 1);
  vi.useRealTimers();
});

describe("constants", () => {
  it("match DESIGN.md", () => {
    expect([TOAST_MS, TOAST_RESUME_MS, TOAST_LEAVE_MS]).toEqual([4600, 2400, 240]);
  });
});

describe("LiveRegion / announce", () => {
  it("is one polite, screen-reader-only paragraph", () => {
    setup();
    expect(live().tagName).toBe("P");
    expect(live().getAttribute("aria-live")).toBe("polite");
    expect(live().classList.contains("sr-only")).toBe(true);
  });

  it("clears, then writes the message 50 ms later so repeats are re-announced", () => {
    setup();
    live().textContent = "old";
    announce("Added to cart");
    expect(live().textContent).toBe("");
    tick(49);
    expect(live().textContent).toBe("");
    tick(1);
    expect(live().textContent).toBe("Added to cart");
  });

  it("re-announces the same text: empty during the gap, then the text again", () => {
    setup();
    announce("A");
    tick(50);
    expect(live().textContent).toBe("A");
    announce("A");
    expect(live().textContent).toBe("");
    tick(49);
    expect(live().textContent).toBe("");
    tick(1);
    expect(live().textContent).toBe("A");
  });

  it("a second <LiveRegion/> renders nothing, and announcements still reach the one region", () => {
    render(
      <>
        <LiveRegion />
        <LiveRegion />
      </>,
    );
    expect(document.querySelectorAll("#live")).toHaveLength(1);
    expect(document.querySelectorAll("[aria-live='polite']")).toHaveLength(1);
    announce("Hello");
    tick(50);
    expect(live().textContent).toBe("Hello");
  });

  it("hands the region to the remaining instance when the owner unmounts", () => {
    function Two({ first }: { first: boolean }) {
      return (
        <>
          {first && <LiveRegion />}
          <LiveRegion />
        </>
      );
    }
    const { rerender } = render(<Two first />);
    expect(document.querySelectorAll("#live")).toHaveLength(1);
    rerender(<Two first={false} />);
    expect(document.querySelectorAll("#live")).toHaveLength(1);
  });

  it("does nothing without a live region", () => {
    expect(() => announce("x")).not.toThrow();
  });
});

describe("Toaster", () => {
  it("shows a toast and announces it after 50 ms", () => {
    setup();
    act(() => toast("Saved"));
    expect(toastEl()!.textContent).toBe("Saved");
    tick(50);
    expect(live().textContent).toBe("Saved");
  });

  it("leaves at 4600 ms and is removed at 4840 ms", () => {
    setup();
    act(() => toast("Saved"));
    const el = () => toastEl()!;
    tick(TOAST_MS - 1);
    expect(el().classList.contains("is-leaving")).toBe(false);
    tick(1);
    expect(el().classList.contains("is-leaving")).toBe(true);
    tick(TOAST_LEAVE_MS - 1);
    expect(toastEl()).not.toBeNull();
    tick(1);
    expect(toastEl()).toBeNull();
  });

  it("pauses on hover and resumes with 2400 ms", () => {
    setup();
    act(() => toast("Saved"));
    const el = toastEl()!;
    tick(1000);
    fireEvent.pointerEnter(el);
    tick(60_000);
    expect(el.classList.contains("is-leaving")).toBe(false);
    fireEvent.pointerLeave(el);
    tick(TOAST_RESUME_MS - 1);
    expect(el.classList.contains("is-leaving")).toBe(false);
    tick(1);
    expect(el.classList.contains("is-leaving")).toBe(true);
  });

  it("pauses while focus is inside and resumes on blur", () => {
    setup();
    act(() => toast("Undo?", { action: "Undo", onAction: () => {} }));
    const btn = screen.getByRole("button", { name: "Undo" });
    fireEvent.focusIn(btn);
    tick(60_000);
    expect(btn.closest(".toast")!.classList.contains("is-leaving")).toBe(false);
    fireEvent.focusOut(btn);
    tick(TOAST_RESUME_MS);
    expect(btn.closest(".toast")!.classList.contains("is-leaving")).toBe(true);
  });

  it("a second toast replaces the first and restarts the clock", () => {
    setup();
    act(() => toast("First"));
    tick(4000);
    act(() => toast("Second"));
    expect(toastEl()!.textContent).not.toContain("First");
    expect(document.querySelectorAll(".toast")).toHaveLength(1);
    expect(toastEl()!.textContent).toBe("Second");
    tick(1000);
    expect(toastEl()!.classList.contains("is-leaving")).toBe(false);
    tick(TOAST_MS - 1000);
    expect(toastEl()!.classList.contains("is-leaving")).toBe(true);
  });

  it("calls onAction once from the action button and dismisses", () => {
    setup();
    const onAction = vi.fn();
    act(() => toast("Removed", { action: "Undo", onAction }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    tick(TOAST_LEAVE_MS);
    expect(toastEl()).toBeNull();
  });

  it("shows the chosen icon, defaulting to a check", () => {
    const { container } = setup();
    act(() => toast("Hi"));
    expect(container.querySelector(".toast svg.i")).not.toBeNull();
    act(() => toast("Heads up", { icon: "alert" }));
    expect(container.querySelector(".toast svg.i")).not.toBeNull();
  });

  it("dismissToast removes it after the leave animation", () => {
    setup();
    act(() => toast("Bye"));
    act(() => dismissToast());
    tick(TOAST_LEAVE_MS);
    expect(toastEl()).toBeNull();
  });

  it("renders nothing when there is no toast", () => {
    const { container } = setup();
    expect(container.querySelector(".toast")).toBeNull();
  });

  it("an action that raises a new toast leaves the new toast alone", () => {
    setup();
    act(() => toast("Removed", { action: "Undo", onAction: () => toast("Restored") }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    tick(TOAST_LEAVE_MS + 1);
    expect(toastEl()!.textContent).toContain("Restored");
    expect(toastEl()!.classList.contains("is-leaving")).toBe(false);
    tick(TOAST_MS - TOAST_LEAVE_MS - 2);
    expect(toastEl()!.classList.contains("is-leaving")).toBe(false);
    tick(2);
    expect(toastEl()!.classList.contains("is-leaving")).toBe(true);
  });

  it("resumes only when both the pointer and focus holds are released", () => {
    setup();
    act(() => toast("Undo?", { action: "Undo", onAction: () => {} }));
    const el = toastEl()!;
    const btn = screen.getByRole("button", { name: "Undo" });
    fireEvent.focusIn(btn);
    fireEvent.pointerEnter(el);
    fireEvent.pointerLeave(el);
    tick(60_000);
    expect(el.classList.contains("is-leaving")).toBe(false);
    fireEvent.focusOut(btn);
    tick(TOAST_RESUME_MS);
    expect(el.classList.contains("is-leaving")).toBe(true);
  });

  it("gives a plain toast a Dismiss button, and Escape dismisses from inside", () => {
    setup();
    act(() => toast("Saved"));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    tick(TOAST_LEAVE_MS);
    expect(toastEl()).toBeNull();
    act(() => toast("Again"));
    fireEvent.keyDown(screen.getByRole("button", { name: "Dismiss" }), { key: "Escape" });
    tick(TOAST_LEAVE_MS);
    expect(toastEl()).toBeNull();
  });

  it("clears its timer and toast on unmount", () => {
    const { unmount } = setup();
    act(() => toast("Gone"));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    setup();
    expect(toastEl()).toBeNull();
  });
});

describe("toast.css", () => {
  const css = readFileSync(path.resolve(import.meta.dirname, "../../styles/toast.css"), "utf8");

  it("keeps the action button at btn-sm's 44px target", () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\.toast \.btn[^{]*\{[^}]*min-height/);
    const buttons = readFileSync(
      path.resolve(import.meta.dirname, "../../styles/buttons.css"),
      "utf8",
    );
    expect(buttons).toMatch(/\.btn-sm \{ min-height: 44px/);
  });
});
