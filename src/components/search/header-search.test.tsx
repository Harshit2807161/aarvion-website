import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routerSpies } from "../../../tests/helpers/navigation-mocks";
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
  window.history.pushState({}, "", "/");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const input = () => screen.getByRole("combobox");
/** Lets the lazily loaded listbox chunk arrive and the debounce and fetch settle. */
const settle = () =>
  act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(400);
  });
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
    expect(input()).not.toHaveAttribute("aria-controls"); // no listbox yet
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
    expect(input()).toHaveAttribute("aria-controls", "sugg");
    expect(input()).not.toHaveAttribute("aria-describedby");
    await settle();
    expect(document.getElementById("live")).toHaveTextContent("3 medicines found");
    expect(screen.getByRole("listbox")).not.toHaveAttribute("aria-live");
  });

  it("ArrowDown then Enter on / reveals the shelf pocket and focuses its Add button", async () => {
    window.history.pushState({}, "", "/");
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
    window.history.pushState({}, "", "/");
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
    window.history.pushState({}, "", "/legal/terms");
    setup();
    await typeQuery("sacu");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(routerSpies.push).toHaveBeenCalledWith("/product/sacuwin-50");
  });

  it("never opens a result that belongs to an earlier query", async () => {
    window.history.pushState({}, "", "/legal/terms");
    setup();
    await typeQuery("sacu");
    expect(screen.getAllByRole("option")).toHaveLength(3);

    // The shopper changes the query; its response is still in flight when Enter is pressed.
    let answer: (r: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => (answer = r)));
    fireEvent.change(input(), { target: { value: "bemp" } });
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(urls().at(-1)).toContain("q=bemp");

    expect(screen.queryAllByRole("option")).toHaveLength(0); // the old list is not offered
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(routerSpies.push).not.toHaveBeenCalled();
    // The form never submits natively with JS running: the Enter is remembered instead.
    expect(fireEvent.submit(input().closest("form")!)).toBe(false);
    expect(routerSpies.push).not.toHaveBeenCalled();

    // Once the current query settles, the remembered Enter opens ITS first result.
    await act(async () => answer(reply(200, [hit("bemptor-180", "Bemptor-180")])));
    expect(routerSpies.push).toHaveBeenCalledTimes(1);
    expect(routerSpies.push).toHaveBeenCalledWith("/product/bemptor-180");
  });

  it("drops a remembered Enter when the shopper keeps typing", async () => {
    window.history.pushState({}, "", "/legal/terms");
    setup();
    let answer: (r: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => (answer = r)));
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "bemp" } });
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(fireEvent.submit(input().closest("form")!)).toBe(false);
    fireEvent.change(input(), { target: { value: "bempt" } });
    await act(async () => answer(reply(200, [hit("bemptor-180", "Bemptor-180")])));
    await settle();
    expect(routerSpies.push).not.toHaveBeenCalled();
  });

  it("Enter with no match stays put and keeps the panel's message", async () => {
    setup();
    await typeQuery("zzz");
    expect(fireEvent.submit(input().closest("form")!)).toBe(false);
    expect(routerSpies.push).not.toHaveBeenCalled();
    expect(screen.getByText(/No medicine matches/)).toBeInTheDocument();
    expect(input()).toHaveValue("zzz");
  });

  it("Enter after a limit or an error stays put and keeps the message", async () => {
    fetchMock.mockImplementation(async () => reply(429));
    setup();
    await typeQuery("sacu");
    expect(fireEvent.submit(input().closest("form")!)).toBe(false);
    expect(routerSpies.push).not.toHaveBeenCalled();
    expect(screen.getByText("Too many searches. Try again in a moment.")).toBeInTheDocument();
    expect(input()).toHaveValue("sacu");
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

  it("shows no chips row when there are no chips", () => {
    setup([]);
    fireEvent.focus(input());
    expect(screen.queryByText("Strength")).toBeNull();
  });

  it("a chip toggles aria-pressed and fetches with its strength", async () => {
    setup();
    fireEvent.focus(input());
    fireEvent.click(screen.getByRole("button", { name: "100" }));
    expect(screen.getByRole("button", { name: "100" })).toHaveAttribute("aria-pressed", "true");
    await settle();
    expect(urls()).toEqual(["/api/products?q=&strength=100"]);
    fireEvent.click(screen.getByRole("button", { name: "200" }));
    expect(screen.getByRole("button", { name: "100" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "200" }));
    expect(screen.getByRole("button", { name: "200" })).toHaveAttribute("aria-pressed", "false");
    expect(document.getElementById("sugg-hint")).not.toBeNull();
  });

  it("ignores a chip that is not a strength", () => {
    setup(["50", "5x", "1234567"]);
    fireEvent.focus(input());
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["50"]);
  });

  it("Escape closes the list, then clears the field, and never propagates the first press", async () => {
    setup();
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    await typeQuery("sacu");
    const panel = document.querySelector(".sugg-panel") as HTMLElement;
    expect(fireEvent.keyDown(input(), { key: "Escape" })).toBe(false);
    expect(panel).toHaveAttribute("hidden");
    expect(input()).toHaveValue("sacu");
    expect(outer).not.toHaveBeenCalled();
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input()).toHaveValue("");
    expect(outer).not.toHaveBeenCalled();
    // nothing left to close or clear: the key may reach an enclosing dialog
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(outer).toHaveBeenCalledTimes(1);
    document.removeEventListener("keydown", outer);
  });

  it("typing reopens a closed panel, and focus leaving the form closes it", async () => {
    setup();
    await typeQuery("sacu");
    fireEvent.keyDown(input(), { key: "Escape" });
    fireEvent.change(input(), { target: { value: "sacuw" } });
    const panel = document.querySelector(".sugg-panel") as HTMLElement;
    expect(panel).not.toHaveAttribute("hidden");
    fireEvent.blur(input(), { relatedTarget: document.body });
    fireEvent.focusOut(screen.getByRole("search"), { relatedTarget: document.body });
    expect(panel).toHaveAttribute("hidden");
  });

  it("a [data-search] click focuses #q", () => {
    setup();
    document.body.insertAdjacentHTML(
      "beforeend",
      `<a href="#q" data-search>Search for a medicine</a>`,
    );
    const a = document.querySelector("[data-search]")!;
    expect(fireEvent.click(a)).toBe(false);
    expect(document.activeElement).toBe(input());
  });

  it("sends no request and logs nothing for a query that is only spaces", async () => {
    const log = vi.spyOn(console, "log");
    setup();
    await typeQuery("   ");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(document.getElementById("sugg-hint")).not.toBeNull();
  });

  it("on / without a pocket on the page it also goes to the product page", async () => {
    window.history.pushState({}, "", "/");
    setup();
    await typeQuery("sacu");
    fireEvent.click(screen.getAllByRole("option")[1]!);
    expect(routerSpies.push).toHaveBeenCalledWith("/product/sacuwin-100");
  });

  it("submit chooses the first result and is prevented", async () => {
    window.history.pushState({}, "", "/legal/terms");
    setup();
    await typeQuery("sacu");
    expect(fireEvent.submit(screen.getByRole("search"))).toBe(false);
    expect(routerSpies.push).toHaveBeenCalledWith("/product/sacuwin-50");
  });

  it("a failed request shows a plain message", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    setup();
    await typeQuery("sacu");
    expect(screen.getByText(/Search is not available right now/)).toBeInTheDocument();
  });

  it("a 429 shows the calm limited message and sends no retry", async () => {
    fetchMock.mockImplementation(async () => reply(429));
    setup();
    await typeQuery("sacu");
    expect(screen.getByText("Too many searches. Try again in a moment.")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Escape on a chip closes the panel and returns focus to the field", () => {
    setup();
    fireEvent.focus(input());
    const chip = screen.getByRole("button", { name: "50" });
    fireEvent.keyDown(chip, { key: "Escape" });
    expect(document.querySelector(".sugg-panel")).toHaveAttribute("hidden");
    expect(document.activeElement).toBe(input());
  });
});
