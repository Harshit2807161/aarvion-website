import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveRegion } from "@/components/feedback/live-region";
import { cartStore, resetCartStore } from "@/lib/cart/store";
import { CartControl } from "./cart-control";
import { CartPill } from "./cart-pill";
import { seedGuest } from "../../../tests/helpers/cart";

const NAME = "Sacuwin 100";
const SLUG = "sacuwin-100";

function setup() {
  return render(
    <>
      <CartPill />
      <CartControl slug={SLUG} name={NAME} />
      <LiveRegion />
    </>,
  );
}
const add = () => screen.getByRole("button", { name: `Add ${NAME} to cart`, hidden: true });
const incBtn = () => document.querySelector<HTMLElement>("[data-inc]")!;
const decBtn = () => document.querySelector<HTMLElement>("[data-dec]")!;
const live = () => document.getElementById("live")!;
const spoken = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60);
  });
  return live().textContent;
};

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  resetCartStore();
});

describe("CartControl", () => {
  it("renders the v2 markup at zero", () => {
    setup();
    const ctl = document.querySelector(".cart-ctl")!;
    expect(ctl.getAttribute("data-qty")).toBe("0");
    expect(add().textContent).toBe("Add to cart");
    const stepper = screen.getByRole("group", { name: `${NAME} in cart`, hidden: true });
    // Changes are spoken only by the single #live region.
    expect(document.querySelector(".cart-ctl [aria-live], .cart-ctl [role=status]")).toBeNull();
    expect(stepper.querySelector("output")).toBeNull();
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
  });

  it("hydrates a stored cart without a mismatch, then shows the stored quantity", async () => {
    vi.useRealTimers();
    seedGuest({ [SLUG]: 2 });
    const html = renderToString(<CartControl slug={SLUG} name={NAME} />);
    expect(html).toContain('data-qty="0"');
    expect(html).toContain("Add to cart");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a));
    await act(async () => {
      hydrateRoot(container, <CartControl slug={SLUG} name={NAME} />, {
        onRecoverableError: (e) => errors.push(e),
      });
    });
    spy.mockRestore();
    expect(errors).toEqual([]);
    expect(container.querySelector(".cart-ctl")?.getAttribute("data-qty")).toBe("2");
    expect(container.querySelector(".qty")?.textContent).toBe("2");
    container.remove();
  });

  it("moves focus from Add to + and announces the count", async () => {
    setup();
    const addBtn = add();
    addBtn.focus();
    fireEvent.click(addBtn);
    expect(document.querySelector(".cart-ctl")?.getAttribute("data-qty")).toBe("1");
    expect(document.activeElement).toBe(incBtn());
    expect(await spoken()).toBe(`${NAME}: 1 in cart`);
    fireEvent.click(incBtn());
    expect(await spoken()).toBe(`${NAME}: 2 in cart`);
  });

  it("returns focus to Add at zero and announces the removal", async () => {
    setup();
    fireEvent.click(add());
    fireEvent.click(decBtn());
    expect(document.querySelector(".cart-ctl")?.getAttribute("data-qty")).toBe("0");
    expect(document.activeElement).toBe(add());
    expect(await spoken()).toBe(`${NAME} removed from cart`);
  });

  it("disables + at 10 and announces the product limit on click", async () => {
    setup();
    fireEvent.click(add());
    for (let i = 0; i < 9; i++) fireEvent.click(incBtn());
    expect(incBtn().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(incBtn());
    expect(document.querySelector(".qty")?.textContent).toBe("10");
    expect(await spoken()).toBe("You can order up to 10 packs of Sacuwin 100.");
  });

  it("announces the order limit when the order is full", async () => {
    seedGuest({ x: 10, y: 9 });
    setup();
    fireEvent.click(add());
    fireEvent.click(incBtn());
    expect(incBtn().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(incBtn());
    expect(await spoken()).toBe("An order can hold up to 20 packs.");
  });
});

describe("a server revert while focus is on the stepper", () => {
  it("moves focus to Add when the line empties, so it is not left on a hidden button", () => {
    setup();
    fireEvent.click(add());
    expect(document.activeElement).toBe(incBtn());
    act(() => void cartStore.dispatch({ type: "remove", slug: SLUG }));
    expect(document.querySelector(".cart-ctl")?.getAttribute("data-qty")).toBe("0");
    expect(document.activeElement).toBe(add());
  });
});

describe("keyboard", () => {
  it("adds with Enter on Add, then Space on +, keeping focus on +", async () => {
    vi.useRealTimers(); // user-event waits on real timers
    const user = userEvent.setup();
    setup();
    await user.tab(); // the pill link
    await user.tab(); // Add
    expect(document.activeElement).toBe(add());
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(incBtn());
    await user.keyboard(" ");
    expect(document.querySelector(".qty")?.textContent).toBe("2");
    expect(document.activeElement).toBe(incBtn());
  });
});

describe("CartPill", () => {
  it("reads 0 packs, then 1 pack, then N packs", () => {
    setup();
    const pill = () => screen.getByRole("link", { name: /^Cart, / });
    expect(pill().getAttribute("aria-label")).toBe("Cart, empty");
    expect(pill().getAttribute("href")).toBe("/cart");
    fireEvent.click(add());
    expect(pill().getAttribute("aria-label")).toBe("Cart, 1 pack");
    fireEvent.click(incBtn());
    expect(pill().getAttribute("aria-label")).toBe("Cart, 2 packs");
    expect(pill().querySelector(".cart-count")?.getAttribute("aria-hidden")).toBe("true");
    expect(pill().querySelector(".cart-count")?.textContent).toBe("2");
  });

  it("bumps the count on a change, not on first render", () => {
    setup();
    const count = () => document.querySelector(".cart-count")!;
    expect(count().classList.contains("bump")).toBe(false);
    fireEvent.click(add());
    expect(count().classList.contains("bump")).toBe(true);
    fireEvent.animationEnd(count());
    expect(count().classList.contains("bump")).toBe(false);
  });
});
