import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_EVENT } from "@/components/auth/account-pill";
import * as sessionState from "@/components/auth/session-state";
import { LiveRegion } from "@/components/feedback/live-region";
import { cartStore, resetCartStore } from "@/lib/cart/store";
import { findClaims } from "../../../tests/helpers/claims";
import { seedGuest } from "../../../tests/helpers/cart";
import { CheckoutLink, Group, PendingLine, ReceiptNotes } from "./cart-page-parts";

vi.mock("@/lib/cart/api", () => ({ quoteCart: vi.fn(() => new Promise(() => {})) }));
vi.mock("@/components/auth/session-state", () => ({ fetchSessionState: vi.fn() }));
const session = vi.mocked(sessionState.fetchSessionState);

const text = () => document.body.textContent!.replace(/\s+/g, " ");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
  resetCartStore();
});

describe("PendingLine", () => {
  it("shows the catalogue name, the Rx mark, the quantity and 'Price updating…', with no price", () => {
    render(
      <ul>
        <PendingLine slug="sacuwin-100" qty={2} known={{ name: "Sacuwin 100", rx: true }} />
      </ul>,
    );
    const li = document.querySelector("li.line--pending[data-slug='sacuwin-100']")!;
    expect(li.querySelector(".line-name")!.textContent).toBe("Sacuwin 100Rx");
    expect(li.querySelector(".line-qty")!.textContent).toBe("Qty 2");
    expect(li.querySelector(".line-pending")!.textContent).toBe("Price updating…");
    expect(li.textContent).not.toMatch(/₹/);
  });

  it("falls back to the slug for a product the catalogue does not know", () => {
    render(
      <ul>
        <PendingLine slug="gone-medicine" qty={1} />
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Remove gone-medicine from cart" })).toBeTruthy();
  });

  it("compact (the drawer) drops the Remove text but keeps its full name", () => {
    render(
      <ul>
        <PendingLine slug="sacuwin-100" qty={1} compact />
      </ul>,
    );
    const remove = screen.getByRole("button", { name: "Remove sacuwin-100 from cart" });
    expect(remove.querySelector("span")).toBeNull();
  });

  it("Remove takes the packs out of the cart and says so through #live", async () => {
    seedGuest({ "sacuwin-100": 2 });
    render(
      <>
        <ul>
          <PendingLine slug="sacuwin-100" qty={2} known={{ name: "Sacuwin 100", rx: true }} />
        </ul>
        <LiveRegion />
      </>,
    );
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole("button", { name: "Remove Sacuwin 100 from cart" }));
    expect(cartStore.getSnapshot()["sacuwin-100"]).toBeUndefined();
    await act(async () => void (await vi.advanceTimersByTimeAsync(60)));
    expect(document.getElementById("live")!.textContent).toBe("Sacuwin 100 removed from cart");
  });
});

describe("Group", () => {
  it("labels the section by its heading, with the medicine count", () => {
    render(<Group id="g-rx" title="Prescription medicines" rows={[]} />);
    const head = screen.getByRole("heading", { level: 2 });
    expect(head.textContent).toBe("Prescription medicines 0 medicines");
    expect(document.querySelector("section")!.getAttribute("aria-labelledby")).toBe("g-rx");
    expect(document.querySelector(".group-head abbr.rx")).not.toBeNull();
  });
});

describe("CheckoutLink", () => {
  it("links to /checkout signed in", () => {
    render(
      <CheckoutLink signedIn className="btn">
        Checkout
      </CheckoutLink>,
    );
    expect(screen.getByRole("link", { name: "Checkout" }).getAttribute("href")).toBe("/checkout");
  });

  it("as a guest links to sign-in, and a plain click opens the dialog for /checkout", async () => {
    render(
      <CheckoutLink signedIn={false} className="btn">
        Checkout
      </CheckoutLink>,
    );
    const a = screen.getByRole("link", { name: "Checkout" });
    expect(a.getAttribute("href")).toBe("/login?next=%2Fcheckout");
    const asked = vi.fn();
    window.addEventListener(LOGIN_EVENT, asked);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(a);
    window.removeEventListener(LOGIN_EVENT, asked);
    expect(asked).toHaveBeenCalledTimes(1);
    expect((asked.mock.calls[0]![0] as CustomEvent).detail).toEqual({ next: "/checkout" });
  });
});

describe("CheckoutLink before the store knows who is signed in (checkSession)", () => {
  const click = async () => {
    render(
      <CheckoutLink signedIn={false} checkSession className="btn">
        Checkout
      </CheckoutLink>,
    );
    const asked = vi.fn();
    window.addEventListener(LOGIN_EVENT, asked);
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole("link", { name: "Checkout" }));
    await act(async () => void (await Promise.resolve()));
    window.removeEventListener(LOGIN_EVENT, asked);
    return { asked, assign };
  };

  it("goes straight to /checkout when the session says someone is signed in", async () => {
    session.mockResolvedValue({ state: "in", name: "Asha" });
    const { asked, assign } = await click();
    expect(assign).toHaveBeenCalledWith("/checkout");
    expect(asked).not.toHaveBeenCalled();
  });

  it("opens the sign-in dialog when nobody is signed in or it cannot tell", async () => {
    for (const state of ["out", "unknown"] as const) {
      session.mockResolvedValue({ state });
      const { asked, assign } = await click();
      expect(asked).toHaveBeenCalledTimes(1);
      expect(assign).not.toHaveBeenCalled();
      document.body.innerHTML = "";
    }
  });
});

describe("ReceiptNotes", () => {
  it("offers cash on delivery only, with no online payment or refund wording, while payments are off", () => {
    render(<ReceiptNotes onlinePayments={false} />);
    expect(text()).toBe("Pay cash on delivery for orders up to ₹5,000.");
    expect(text()).not.toMatch(/UPI|refund/i);
    expect(findClaims(text())).toEqual([]);
  });

  it("shows the prototype's payment and refund notes once online payments are on", () => {
    render(<ReceiptNotes onlinePayments />);
    expect(text()).toContain("Pay online by UPI, card or netbanking");
    expect(text()).toContain("you get a full refund");
  });
});
