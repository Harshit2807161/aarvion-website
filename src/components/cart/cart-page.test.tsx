import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sessionState from "@/components/auth/session-state";
import { LiveRegion } from "@/components/feedback/live-region";
import * as api from "@/lib/cart/api";
import { cartStore, resetCartStore } from "@/lib/cart/store";
import type { PricedLine } from "@/server/cart/service";
import { countWord } from "@/lib/catalogue/display";
import { cartTotals } from "@/server/catalogue/cart-totals";
import { findClaims } from "../../../tests/helpers/claims";
import { pricedLine, seedGuest } from "../../../tests/helpers/cart";
import { CartPage } from "./cart-page";
import type { KnownProduct } from "./cart-page-parts";

vi.mock("@/lib/cart/api", () => ({
  getCart: vi.fn(),
  addItem: vi.fn(),
  setQty: vi.fn(),
  removeItem: vi.fn(),
  mergeCart: vi.fn(),
  quoteCart: vi.fn(),
}));
const m = vi.mocked(api);
vi.mock("@/components/auth/session-state", () => ({ fetchSessionState: vi.fn() }));
const session = vi.mocked(sessionState.fetchSessionState);

const SACU = pricedLine(2);
const WIN = pricedLine(1, { slug: "win2age", name: "Win2Age", mrpPaise: 30000 });
const KNOWN: Record<string, KnownProduct> = {
  "sacuwin-100": { name: "Sacuwin 100", rx: true },
  win2age: { name: "Win2Age", rx: true },
};
const viewOf = (lines: PricedLine[]) => ({ lines, totals: cartTotals(lines), removed: [] });
const quotes = (...lines: PricedLine[]) =>
  m.quoteCart.mockImplementation(() => Promise.resolve({ ok: true, view: viewOf(lines) }));

/** Lets the lazy quote chunk arrive and the 400 ms debounce pass. */
const settle = async () => {
  await act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(500);
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(100);
  });
};
const text = () => document.body.textContent!.replace(/\s+/g, " ");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
  vi.resetAllMocks();
  resetCartStore();
  session.mockResolvedValue({ state: "out" });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderPage = (onlinePayments = false) =>
  render(
    <>
      <CartPage
        medicineWord={countWord(11).toLowerCase()}
        onlinePayments={onlinePayments}
        known={KNOWN}
      />
      <LiveRegion />
    </>,
  );

async function signIn(lines: PricedLine[]) {
  m.getCart.mockImplementation(() => Promise.resolve({ ok: true, view: viewOf(lines) }) as never);
  await act(async () => {
    await cartStore.signIn();
  });
}

describe("CartPage with lines", () => {
  it("prices a stored guest cart on mount, with no interaction and no CartSync", async () => {
    seedGuest({ "sacuwin-100": 2, win2age: 1 });
    quotes(SACU, WIN);
    renderPage();
    await settle();
    expect(m.quoteCart).toHaveBeenCalledTimes(1);
    const group = screen.getByRole("region", { name: /Prescription medicines/ });
    expect(group.querySelectorAll("li.line")).toHaveLength(2);
    expect(group.querySelector(".count")!.textContent).toBe("2 medicines");
    expect(text()).toContain(
      "A pharmacist checks your prescription before we pack. At checkout you can upload one, or choose one you’ve uploaded before.",
    );
    expect(document.querySelector(".sum")).not.toBeNull();
    expect(document.querySelector(".sum-total")!.textContent).toContain("₹1,054");
    expect(document.querySelector(".receipt-head")!.textContent).toContain("3 packs");
    expect(screen.queryByRole("region", { name: /without a prescription/ })).toBeNull();
  });

  it("before the first priced view, shows pending rows with Remove and no totals", async () => {
    seedGuest({ "sacuwin-100": 2, "gone-slug": 1 });
    m.quoteCart.mockImplementation(() => Promise.resolve({ ok: false, error: "network" }) as never);
    renderPage();
    await settle();
    const rows = document.querySelectorAll("li.line--pending");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("Sacuwin 100");
    expect(rows[0]!.textContent).toContain("Price updating…");
    expect(rows[0]!.querySelector(".line-qty")!.textContent).toBe("Qty 2");
    expect(rows[1]!.textContent).toContain("gone-slug"); // not in the catalogue: the slug
    expect(document.querySelector(".receipt")!.getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector(".sum")).toBeNull();
    expect(document.querySelector(".receipt-head")!.nextElementSibling!.textContent).toBe(
      "Updating totals…",
    );
    expect(screen.getByRole("button", { name: "Remove Sacuwin 100 from cart" })).toBeTruthy();
  });

  it("links Checkout to /checkout signed in", async () => {
    await signIn([SACU, WIN]);
    renderPage();
    const links = document.querySelectorAll<HTMLAnchorElement>("a[data-checkout]");
    expect(links).toHaveLength(1);
    links.forEach((a) => expect(a.getAttribute("href")).toBe("/checkout"));
  });

  it("as a guest, links Checkout to sign-in (a plain click opens the dialog: cart-page-parts.test)", async () => {
    seedGuest({ "sacuwin-100": 2 });
    quotes(SACU);
    renderPage();
    await settle();
    const a = document.querySelector<HTMLAnchorElement>(".receipt a[data-checkout]")!;
    expect(a.getAttribute("href")).toBe("/login?next=%2Fcheckout");
  });

  it("says cash on delivery, and nothing about online payment or refunds, while online payments are off", async () => {
    seedGuest({ "sacuwin-100": 2 });
    quotes(SACU);
    renderPage(false);
    await settle();
    expect(text()).toContain("Pay cash on delivery for orders up to ₹5,000.");
    expect(text()).toMatch(/cash on delivery/);
    expect(text()).not.toMatch(/UPI/);
    expect(text()).not.toMatch(/refund/i);
    expect(findClaims(text())).toEqual([]);
  });

  it("shows the limit note at 20 packs", async () => {
    seedGuest({ "sacuwin-100": 10, win2age: 9 });
    quotes(pricedLine(10), { ...WIN, qty: 9 });
    renderPage();
    await settle();
    expect(document.querySelector(".cart-limit")).toBeNull();
    await act(async () => void cartStore.dispatch({ type: "inc", slug: "win2age" }));
    expect(document.querySelector(".cart-limit")!.textContent).toBe(
      "You’ve reached 20 packs, the most one order can hold. Place this order, then start another.",
    );
  });

  it("says totals are updating, never a stale total, while re-pricing", async () => {
    seedGuest({ "sacuwin-100": 2 });
    quotes(SACU);
    renderPage();
    await settle();
    expect(document.querySelector(".sum")!.hasAttribute("data-updating")).toBe(false);
    await act(async () => void cartStore.dispatch({ type: "inc", slug: "sacuwin-100" }));
    expect(document.querySelector(".sum")!.hasAttribute("data-updating")).toBe(true);
    expect(document.querySelector(".sum-updating")!.textContent).toBe("Updating totals…");
  });
});

describe("CartPage without lines", () => {
  const empty = () => screen.queryByRole("heading", { name: "Your cart is empty" });
  const busy = () => document.querySelector("[aria-busy='true']")?.textContent;

  it("renders the loading state on the server, with no totals and no empty state", () => {
    const html = renderToString(
      <CartPage medicineWord="eleven" onlinePayments={false} known={KNOWN} />,
    );
    expect(html).toContain("Loading your cart…");
    expect(html).not.toMatch(/₹|Your cart is empty/);
  });

  it("shows a plain guest's empty cart once its own session check says out, without CartSync", async () => {
    renderPage();
    await settle();
    expect(empty()).not.toBeNull();
    expect(busy()).toBeUndefined();
    expect(text()).toContain(
      "Find your medicine by brand or salt, then add it here. Every pack is its printed MRP less ₹20.",
    );
    const browse = screen.getByRole("link", { name: "Browse all eleven medicines" });
    expect(browse.getAttribute("href")).toBe("/#medicines");
    expect(findClaims(text())).toEqual([]);
    expect(document.querySelector("[aria-live], output")).toBe(document.getElementById("live"));
  });

  it("shows the empty state when the session cannot be found out (unknown)", async () => {
    session.mockResolvedValue({ state: "unknown" });
    renderPage();
    await settle();
    expect(empty()).not.toBeNull();
    expect(cartStore.getMode()).toBe("unknown");
  });

  it("stays on loading while its session check is pending, so a signed-in cart never flashes empty", async () => {
    let answer!: (v: { state: "in"; name: string }) => void;
    session.mockImplementation(() => new Promise((r) => (answer = r)));
    let cart!: (v: unknown) => void;
    m.getCart.mockImplementation(() => new Promise((r) => (cart = r)) as never);
    renderPage();
    await settle();
    expect(busy()).toBe("Loading your cart…"); // first client paint: the check is pending
    expect(empty()).toBeNull();
    await act(async () => answer({ state: "in", name: "Asha" }));
    await settle();
    expect(busy()).toBe("Loading your cart…"); // signed in: the cart is loading
    expect(empty()).toBeNull();
    await act(async () => cart({ ok: true, view: viewOf([SACU]) }));
    await settle();
    expect(document.querySelector("li.line[data-slug='sacuwin-100']")).not.toBeNull();
  });

  it("loads a signed-in cart: busy while it loads, then its lines", async () => {
    session.mockResolvedValue({ state: "in", name: "Asha" });
    let answer!: (v: unknown) => void;
    m.getCart.mockImplementation(() => new Promise((r) => (answer = r)) as never);
    renderPage();
    await settle();
    expect(busy()).toBe("Loading your cart…");
    expect(empty()).toBeNull();
    await act(async () => answer({ ok: true, view: viewOf([SACU]) }));
    await settle();
    expect(document.querySelector("li.line[data-slug='sacuwin-100']")).not.toBeNull();
    expect(document.querySelector(".receipt a[data-checkout]")!.getAttribute("href")).toBe(
      "/checkout",
    );
  });

  it("falls back to the empty state when a signed-in load fails", async () => {
    session.mockResolvedValue({ state: "in", name: "Asha" });
    m.getCart.mockImplementation(() => Promise.resolve({ ok: false, error: "network" }) as never);
    renderPage();
    await settle();
    expect(busy()).toBeUndefined();
    expect(empty()).not.toBeNull();
  });
});
