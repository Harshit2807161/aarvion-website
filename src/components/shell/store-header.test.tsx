import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockPathname } from "../../../tests/helpers/navigation-mocks";
import { SkipLink } from "./skip-link";
import { StoreHeader } from "./store-header";

type IoCallback = (entries: { isIntersecting: boolean }[]) => void;
let ioCallback: IoCallback | null = null;
const observed: Element[] = [];

beforeEach(() => {
  ioCallback = null;
  observed.length = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IoCallback) {
        ioCallback = cb;
      }
      observe(el: Element) {
        observed.push(el);
      }
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const href = (name: string | RegExp) => screen.getByRole("link", { name }).getAttribute("href");

describe("StoreHeader", () => {
  it("is the sticky header row with the brand home link", () => {
    const { container } = render(<StoreHeader />);
    expect(
      container.querySelector("header.store-head[data-store-head] > .wrap.sh-row"),
    ).not.toBeNull();
    expect(href(/Aarvion.*home/)).toBe("/");
  });

  it("has the labelled search field", () => {
    const { container } = render(<StoreHeader />);
    const q = screen.getByLabelText("Search medicines by brand or salt");
    expect(q.id).toBe("q");
    expect(q).toHaveAttribute("type", "search");
    expect(q).toHaveAttribute("placeholder", "Search medicines by brand or salt");
    expect(container.querySelector("form.search[role=search]")).not.toBeNull();
  });

  it("links Upload prescription, Sign in and the empty cart", () => {
    render(<StoreHeader />);
    expect(href("Upload prescription")).toBe("/account/prescriptions");
    expect(href("Sign in")).toBe("/login");
    expect(href("Cart, empty")).toBe("/cart");
    expect(
      screen.getByRole("link", { name: "Cart, empty" }).querySelector(".cart-count")?.textContent,
    ).toBe("0");
  });

  it("keeps the Sign in name when the visible label is hidden", () => {
    render(<StoreHeader />);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("aria-label", "Sign in");
    link.querySelector(".acct-label")!.remove();
    expect(screen.getByRole("link", { name: "Sign in" })).toBe(link);
  });

  it("lets Tasks 15, 37 and 43 replace the cart, search and account slots", () => {
    render(<StoreHeader search={<p>S</p>} account={<p>A</p>} cart={<p>C</p>} />);
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByLabelText("Search medicines by brand or salt")).toBeNull();
  });

  it("adds is-stuck to the header and the category bar once the announcement scrolls away", () => {
    const bar = document.createElement("div");
    bar.setAttribute("data-announce", "");
    const cat = document.createElement("nav");
    cat.className = "catbar";
    document.body.append(bar, cat);
    const { container } = render(<StoreHeader />);
    const head = container.querySelector("header")!;
    expect(observed).toContain(bar);
    act(() => ioCallback!([{ isIntersecting: false }]));
    expect(head).toHaveClass("is-stuck");
    expect(cat).toHaveClass("is-stuck");
    act(() => ioCallback!([{ isIntersecting: true }]));
    expect(head).not.toHaveClass("is-stuck");
    expect(cat).not.toHaveClass("is-stuck");
    bar.remove();
    cat.remove();
  });

  it("never listens for scroll", () => {
    const spy = vi.spyOn(window, "addEventListener");
    render(<StoreHeader />);
    expect(spy.mock.calls.filter(([type]) => type === "scroll")).toHaveLength(0);
    spy.mockRestore();
  });
});

describe("SkipLink", () => {
  it("skips to the medicines on the home page", () => {
    mockPathname.value = "/";
    render(<SkipLink />);
    expect(href("Skip to medicines")).toBe("#medicines");
  });

  it("skips to the main content elsewhere", () => {
    mockPathname.value = "/legal/terms";
    render(<SkipLink />);
    expect(href("Skip to content")).toBe("#main");
  });
});
