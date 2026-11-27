import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_DELAY_MS, LazyHeaderSearch } from "./lazy-header-search";

const input = () => document.getElementById("q") as HTMLInputElement;
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ results: [] }))),
  );
  window.requestIdleCallback = undefined as never;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LazyHeaderSearch", () => {
  it("renders the plain search form first, with no combobox", () => {
    render(<LazyHeaderSearch chips={["50"]} />);
    const q = input();
    expect(q.type).toBe("search");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(q.closest("form")?.getAttribute("action")).toBe("/#medicines");
  });

  it("swaps in the combobox on focus and keeps the typed text, the caret and the focus", async () => {
    render(<LazyHeaderSearch chips={["50"]} />);
    const plain = input();
    plain.focus();
    fireEvent.change(plain, { target: { value: "sacuwin" } });
    plain.setSelectionRange(3, 3);
    fireEvent.focus(plain);
    const box = (await screen.findByRole("combobox")) as HTMLInputElement;
    expect(box.value).toBe("sacuwin");
    expect(document.activeElement).toBe(box);
    expect([box.selectionStart, box.selectionEnd]).toEqual([3, 3]);
    expect(document.querySelectorAll("#q")).toHaveLength(1);
  });

  it("swaps in on pointer down too, and only once", async () => {
    render(<LazyHeaderSearch chips={[]} />);
    fireEvent.pointerDown(input());
    fireEvent.focus(input());
    expect(await screen.findByRole("combobox")).toBeTruthy();
    expect(document.querySelectorAll("#q")).toHaveLength(1);
  });

  it("swaps in when the browser is idle, with nothing focused", async () => {
    window.requestIdleCallback = ((cb: () => void) => {
      cb();
      return 1;
    }) as never;
    window.cancelIdleCallback = (() => {}) as never;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<LazyHeaderSearch chips={[]} />);
    window.dispatchEvent(new Event("load")); // the idle timer starts after window load
    expect(screen.queryByRole("combobox")).toBeNull();
    vi.advanceTimersByTime(IDLE_DELAY_MS - 1);
    expect(screen.queryByRole("combobox")).toBeNull();
    vi.advanceTimersByTime(1);
    vi.useRealTimers();
    const box = (await screen.findByRole("combobox")) as HTMLInputElement;
    expect(box.value).toBe("");
    expect(document.activeElement).not.toBe(box);
  });
});
