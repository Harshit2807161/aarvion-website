import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { routerSpies } from "../../../tests/helpers/navigation-mocks";
import type { SearchResult } from "@/lib/catalogue/search-result";
import { HeaderSearch } from "./header-search";

/**
 * Enter does not need the listbox chunk (#245-M1): it opens the first result of the settled
 * search, so it works while `./suggestion-list` is still on its way (held here, never released).
 */
vi.mock("./suggestion-list", () => new Promise(() => {}));

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
  routerSpies.push.mockClear();
  window.history.pushState({}, "", "/contact");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const settle = () => act(() => vi.advanceTimersByTimeAsync(400));
const submit = (input: HTMLElement) => fireEvent.submit(input.closest("form")!);

it("Enter on a settled search opens its first result before the listbox chunk arrives", async () => {
  render(<HeaderSearch chips={[]} />);
  const input = screen.getByRole("combobox");
  input.focus();
  fireEvent.change(input, { target: { value: "valsartan" } });
  await settle();
  expect(screen.queryByRole("listbox")).toBeNull();
  submit(input);
  expect(routerSpies.push).toHaveBeenCalledWith("/product/sacuwin-50");
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("Enter while the search is loading is remembered and fires once it settles, chunk or not", async () => {
  render(<HeaderSearch chips={[]} />);
  const input = screen.getByRole("combobox");
  input.focus();
  fireEvent.change(input, { target: { value: "valsartan" } });
  submit(input); // before the 150 ms debounce and the fetch
  expect(routerSpies.push).not.toHaveBeenCalled();
  await settle();
  expect(routerSpies.push).toHaveBeenCalledWith("/product/sacuwin-50");
  expect(screen.queryByRole("listbox")).toBeNull();
});
