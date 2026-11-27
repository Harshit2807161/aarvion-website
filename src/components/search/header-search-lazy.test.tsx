import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveRegion } from "@/components/feedback/live-region";
import type { SearchResult } from "@/lib/catalogue/search-result";
import { HeaderSearch } from "./header-search";

/**
 * The listbox is a lazy chunk (`./suggestion-list`). Here its import waits on a gate the test
 * opens, so typing happens while the chunk is still on its way. The input must never be replaced,
 * what was typed must stay, and the combobox ARIA must stay valid before and after.
 */
let openGate!: () => void;
const gate = new Promise<void>((r) => (openGate = r));
vi.mock("./suggestion-list", async (importOriginal) => {
  await gate;
  return importOriginal();
});

const hit = (slug: string, name: string): SearchResult => ({
  slug,
  name,
  salt: "Sacubitril + Valsartan",
  pack: "10 tablets",
  mrpPaise: 50000,
  pricePaise: 48000,
  image: null,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        results: [hit("sacuwin-50", "Sacuwin 50"), hit("sacuwin-100", "Sacuwin 100")],
      }),
    ),
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Every id an ARIA reference on the input names must exist in the document. */
function ariaRefsResolve(input: HTMLElement): boolean {
  return ["aria-controls", "aria-activedescendant", "aria-describedby"].every((attr) => {
    const id = input.getAttribute(attr);
    return id === null || document.getElementById(id) !== null;
  });
}

describe("HeaderSearch before and after the listbox chunk arrives", () => {
  it("keeps the same input and the text typed before the chunk, then lists results for it", async () => {
    render(
      <>
        <HeaderSearch chips={[]} />
        <LiveRegion />
      </>,
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "sacu" } });
    await act(() => vi.advanceTimersByTimeAsync(400)); // the fetch answered; the chunk has not

    expect(input.value).toBe("sacu");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(ariaRefsResolve(input)).toBe(true);
    fireEvent.keyDown(input, { key: "ArrowDown" }); // no options yet: nothing to point at
    expect(ariaRefsResolve(input)).toBe(true);

    await act(async () => {
      openGate();
      await vi.dynamicImportSettled();
    });

    expect(screen.getByRole("combobox")).toBe(input); // never remounted or replaced
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("sacu");
    expect(screen.getAllByRole("option")).toHaveLength(2); // filtered on the current value
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", "sugg");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "sugg-opt-0");
    expect(ariaRefsResolve(input)).toBe(true);
  });
});
