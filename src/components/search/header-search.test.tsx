import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockPathname, routerSpies } from "../../../tests/helpers/navigation-mocks";
import { LiveRegion } from "@/components/feedback/live-region";
import type { SearchResult } from "@/lib/catalogue/search-result";
import { HeaderSearch } from "./header-search";

const hit = (slug: string, name: string): SearchResult => ({
  slug,
  name,
  salt: "Sacubitril + Valsartan",
  pack: "10 tablets",
  mrpPaise: 50000,
  pricePaise: 48000,
  image: null,
});
const THREE = [
  hit("sacuwin-50", "Sacuwin 50"),
  hit("sacuwin-100", "Sacuwin 100"),
  hit("sacuwin-200", "Sacuwin 200"),
];

let fetchMock: ReturnType<typeof vi.fn>;
const urls = () => fetchMock.mock.calls.map((c) => c[0] as string);

function reply(status: number, results: SearchResult[] = []) {
  return new Response(JSON.stringify({ results }), { status });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async (url: string) => {
    if (url.includes("zzz")) return reply(200, []);
    return reply(200, THREE);
  });
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const input = () => screen.getByRole("combobox");
const settle = () => act(() => vi.advanceTimersByTimeAsync(400));
async function typeQuery(v: string) {
  fireEvent.focus(input());
  fireEvent.change(input(), { target: { value: v } });
  await settle();
}

function setup(chips = ["50", "100", "200"]) {
  return render(
    <>
      <HeaderSearch chips={chips} />
      <LiveRegion />
    </>,
  );
}

describe("HeaderSearch", () => {
  it("is a labelled search form with the combobox wiring", () => {
    setup();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(input()).toHaveAttribute("id", "q");
    expect(input()).toHaveAccessibleName("Search medicines by brand or salt");
    expect(input()).toHaveAttribute("aria-controls", "sugg");
    expect(input()).toHaveAttribute("aria-describedby", "sugg-hint");
    expect(input()).toHaveAttribute("name", "q");
    expect(screen.getByRole("search")).toHaveAttribute("action");
  });

  it("keeps focus in the input when a chip is pressed, so the panel survives mousedown", () => {
    setup();
    fireEvent.focus(input());
    const chip = screen.getByRole("button", { name: "100" });
    expect(fireEvent.pointerDown(chip)).toBe(false);
    expect(fireEvent.mouseDown(chip)).toBe(false);
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("focusing opens the panel with the chips first, then the hint", () => {
    setup();
    const panel = document.querySelector(".sugg-panel") as HTMLElement;
    expect(panel).toHaveAttribute("hidden");
    fireEvent.focus(input());
    expect(panel).not.toHaveAttribute("hidden");
    expect(screen.getAllByRole("button", { pressed: false }).map((b) => b.textContent)).toEqual([
      "50",
      "100",
      "200",
    ]);
    expect(screen.getByText("Strength")).toBeInTheDocument();
    expect(document.getElementById("sugg-hint")).toHaveTextContent(
      "Type a brand such as Sacuwin or a salt such as Valsartan.",
    );
    expect(panel.firstElementChild).toHaveClass("chips");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("typing sacu shows 3 options and announces the count through #live", async () => {
    setup();
    await typeQuery("sacu");
    expect(urls()).toEqual(["/api/products?q=sacu"]);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(document.getElementById("sugg-hint")).toBeNull();
    expect(input()).toHaveAttribute("aria-expanded", "true");
    await settle();
    expect(document.getElementById("live")).toHaveTextContent("3 medicines found");
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-live");
  });

  it("ArrowDown then Enter on / reveals the shelf pocket and focuses its Add button", async () => {
    mockPathname.value = "/";
    document.body.insertAdjacentHTML(
      "beforeend",
      `<article id="p-sacuwin-50" class="is-found-old"><div class="cart-ctl"><button data-add>Add</button></div></article>
       <article id="p-sacuwin-100" class="is-found"></article>`,
    );
    setup();
    await typeQuery("sacu");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input()).toHaveAttribute("aria-activedescendant", "sugg-opt-0");
    fireEvent.keyDown(input(), { key: "Enter" });
    const pocket = document.getElementById("p-sacuwin-50")!;
    expect(pocket.scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "center" });
    expect(pocket).toHaveClass("is-found");
    expect(document.getElementById("p-sacuwin-100")).not.toHaveClass("is-found");
    expect(document.activeElement).toBe(pocket.querySelector("[data-add]"));
    expect(routerSpies.push).not.toHaveBeenCalled();
  });

  it("focuses the stepper's + when the pocket is already in the cart", async () => {
    mockPathname.value = "/";
    document.body.insertAdjacentHTML(
      "beforeend",
      `<article id="p-sacuwin-50"><div class="cart-ctl" data-qty="2"><button data-add>Add</button><button data-inc>+</button></div></article>`,
    );
    setup();
    await typeQuery("sacu");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(document.activeElement).toBe(document.querySelector("[data-inc]"));
  });

  it("Enter on another page goes to the product page", async () => {
    mockPathname.value = "/legal/terms";
    setup();
    await typeQuery("sacu");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(routerSpies.push).toHaveBeenCalledWith("/product/sacuwin-50");
  });

  it("zzz shows the empty text exactly", async () => {
    setup();
    await typeQuery("zzz");
    expect(
      screen.getByText(
        "No medicine matches. Try a brand such as Sacuwin or a salt such as Valsartan.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(input()).toHaveAttribute("aria-expanded", "false");
    await settle();
    expect(document.getElementById("live")).toHaveTextContent("No medicine matches");
  });
});
