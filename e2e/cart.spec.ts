import { expect, test } from "@playwright/test";
import { CART_GUEST_STORAGE_KEY, CART_LIMITS } from "../src/lib/cart/cart";
import { collectConsoleErrors } from "./helpers/console";

/**
 * Add to cart on the real pages: Add becomes a stepper, the header pill counts, the quantity
 * survives a client navigation and a reload, and a cart already in sessionStorage hydrates without
 * console errors (the plan names cart quantities from storage as a hydration risk).
 */
const ADD = { name: "Add Sacuwin 100 to cart" };
const pill = (page: import("@playwright/test").Page) => page.locator(".sh-cart");

test("Add becomes a stepper, the pill counts, and the quantity survives navigation and reload", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/category/cardiology");
  await expect(pill(page)).toHaveAttribute("aria-label", "Cart, empty");

  await page.getByRole("button", ADD).click();
  const ctl = page.locator("#p-sacuwin-100 .cart-ctl");
  await expect(ctl).toHaveAttribute("data-qty", "1");
  await expect(ctl.locator(".qty")).toHaveText("1");
  await expect(page.locator("#live")).toHaveText("Sacuwin 100: 1 in cart");
  await expect(pill(page)).toHaveAttribute("aria-label", "Cart, 1 pack");
  await expect(pill(page).locator(".cart-count")).toHaveText("1");

  // The stepper goes both ways.
  await ctl.getByRole("button", { name: "Add one more Sacuwin 100" }).click();
  await expect(ctl.locator(".qty")).toHaveText("2");
  await ctl.getByRole("button", { name: "Remove one Sacuwin 100" }).click();
  await expect(ctl.locator(".qty")).toHaveText("1");

  // A client navigation to the product page keeps the quantity.
  await page.locator("#p-sacuwin-100 a[href='/product/sacuwin-100']").first().click();
  await expect(page).toHaveURL(/\/product\/sacuwin-100$/);
  const buyBox = page.locator("main .cart-ctl").first();
  await expect(buyBox.locator(".qty")).toHaveText("1");
  await expect(pill(page).locator(".cart-count")).toHaveText("1");

  // So does a reload, with no hydration or other console errors.
  await page.reload();
  await expect(page.locator("main .cart-ctl").first().locator(".qty")).toHaveText("1");
  await expect(pill(page)).toHaveAttribute("aria-label", "Cart, 1 pack");
  expect(errors()).toEqual([]);
});

test("a stored cart hydrates into the stepper and the pill with no console errors", async ({
  page,
}) => {
  await page.addInitScript(
    ([key, lines]) => sessionStorage.setItem(key as string, JSON.stringify(lines)),
    [
      CART_GUEST_STORAGE_KEY,
      {
        lines: [
          { slug: "sacuwin-100", qty: 3 },
          { slug: "hyloage", qty: 2 },
        ],
      },
    ] as const,
  );
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  await expect(pill(page)).toHaveAttribute("aria-label", "Cart, 5 packs");
  await expect(page.locator("#p-sacuwin-100 [data-qty]")).toHaveAttribute("data-qty", "3");
  await expect(page.locator("#p-hyloage [data-qty]")).toHaveAttribute("data-qty", "2");
  expect(errors()).toEqual([]);
});

test("the 10-per-product limit is explained through the live region", async ({ page }) => {
  await page.goto("/product/sacuwin-100");
  const ctl = page.locator("main .cart-ctl").first();
  await ctl.getByRole("button", ADD).click();
  const more = ctl.getByRole("button", { name: "Add one more Sacuwin 100" });
  for (let i = 1; i < CART_LIMITS.perProduct; i++) await more.click();
  await expect(ctl.locator(".qty")).toHaveText(String(CART_LIMITS.perProduct));
  // At the limit the + stays focusable with aria-disabled, which Playwright treats as disabled.
  await more.click({ force: true });
  await expect(ctl.locator(".qty")).toHaveText(String(CART_LIMITS.perProduct));
  await expect(page.locator("#live")).toHaveText(
    `You can order up to ${CART_LIMITS.perProduct} packs of Sacuwin 100.`,
  );
});
