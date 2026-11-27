import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeaderSearch } from "./header-search";

/**
 * An IME composition in progress when the listbox chunk arrives is not interrupted: the input is
 * the same node, keeps focus and its composing text, and the composition ends normally. Its own
 * file, so the chunk's import (held on a gate) happens during the composition.
 */
let openGate!: () => void;
const gate = new Promise<void>((r) => (openGate = r));
vi.mock("./suggestion-list", async (importOriginal) => {
  await gate;
  return importOriginal();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ results: [] })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("does not break a composition in progress when the chunk arrives", async () => {
  render(<HeaderSearch chips={[]} />);
  const input = screen.getByRole("combobox") as HTMLInputElement;
  input.focus();
  const ended = vi.fn();
  input.addEventListener("compositionend", ended);

  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: "さく" } });
  // An IME's Enter (keyCode 229) during the composition is left to the IME.
  expect(fireEvent.keyDown(input, { key: "Enter", keyCode: 229, isComposing: true })).toBe(true);

  await act(async () => {
    openGate();
    await vi.dynamicImportSettled();
  });

  expect(screen.getByRole("combobox")).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("さく");
  fireEvent.change(input, { target: { value: "サクビ" } });
  fireEvent.compositionEnd(input, { data: "サクビ" });
  expect(ended).toHaveBeenCalledTimes(1);
  expect(input.value).toBe("サクビ");
  expect(document.activeElement).toBe(input);
});
