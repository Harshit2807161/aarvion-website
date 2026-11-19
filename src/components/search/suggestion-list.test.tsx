import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SearchResult } from "@/lib/catalogue/search-result";
import { SuggestionList } from "./suggestion-list";

const item = (over: Partial<SearchResult> = {}): SearchResult => ({
  slug: "entresto-50",
  name: "Entresto 50",
  salt: "Sacubitril 24 mg + Valsartan 26 mg",
  pack: "10 tablets",
  mrpPaise: 50000,
  pricePaise: 48000,
  image: {
    src: "/products/entresto/aaaaaaaa.webp",
    width: 200,
    height: 200,
    alt: "Entresto strip",
  },
  ...over,
});

describe("SuggestionList", () => {
  it("renders a listbox of options with name, salt and pack, price and thumbnail", () => {
    render(
      <SuggestionList
        id="l"
        items={[item(), item({ slug: "b", name: "Beta", image: null })]}
        tokens={["entr"]}
        active={-1}
        onChoose={() => {}}
        emptyText="Nothing"
        optionId={(i) => `o${i}`}
      />,
    );
    const list = screen.getByRole("listbox");
    expect(list).toHaveAttribute("id", "l");
    expect(list).not.toHaveAttribute("aria-live");
    expect(list).not.toHaveAttribute("role", "status");
    const opts = within(list).getAllByRole("option");
    expect(opts).toHaveLength(2);
    expect(opts[0]).toHaveAttribute("id", "o0");
    expect(opts[0]).toHaveTextContent("Entresto 50");
    expect(opts[0]).toHaveTextContent("Sacubitril 24 mg + Valsartan 26 mg · 10 tablets");
    expect(opts[0]!.querySelector("mark")!.textContent).toBe("Entr");
    expect(opts[0]!.querySelector("img")).toHaveAttribute("width", "44");
    expect(opts[0]!.querySelector(".price-inline")).not.toBeNull();
    expect(opts[1]!.querySelector("img")).toBeNull();
  });

  it("marks the active option with aria-selected", () => {
    render(
      <SuggestionList
        id="l"
        items={[item(), item({ slug: "b" })]}
        tokens={[]}
        active={1}
        onChoose={() => {}}
        emptyText="x"
        optionId={(i) => `o${i}`}
      />,
    );
    const opts = screen.getAllByRole("option");
    expect(opts[0]).toHaveAttribute("aria-selected", "false");
    expect(opts[1]).toHaveAttribute("aria-selected", "true");
  });

  it("chooses on click and prevents pointerdown so the input keeps focus", () => {
    const onChoose = vi.fn();
    render(
      <SuggestionList
        id="l"
        items={[item()]}
        tokens={[]}
        active={-1}
        onChoose={onChoose}
        emptyText="x"
        optionId={(i) => `o${i}`}
      />,
    );
    const opt = screen.getByRole("option");
    expect(fireEvent.pointerDown(opt)).toBe(false);
    fireEvent.click(opt);
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ slug: "entresto-50" }));
  });

  it("shows the empty text as plain text, not an option", () => {
    render(
      <SuggestionList
        id="l"
        items={[]}
        tokens={[]}
        active={-1}
        onChoose={() => {}}
        emptyText="No medicines found"
        optionId={(i) => `o${i}`}
      />,
    );
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No medicines found")).toBeInTheDocument();
  });
});
