import { type APIRequestContext, expect, test } from "@playwright/test";
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

// ── The /cart page (Task K6) ──────────────────────────────────────────────

/** The newest 6-digit code sent to `email` (mock providers write it to /dev/outbox). */
async function lastCode(request: APIRequestContext, email: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(async () => {
      const res = await request.get(`/dev/outbox?to=${encodeURIComponent(email)}`);
      const { messages } = (await res.json()) as { messages: { payload: { text: string } }[] };
      code = messages.length ? /\d{6}/.exec(messages.at(-1)!.payload.text)?.[0] : undefined;
      return code;
    })
    .toMatch(/^\d{6}$/);
  return code!;
}
const total = (page: import("@playwright/test").Page) => page.locator(".receipt .sum-total");

test("/cart prices a stored guest cart on first load, with no interaction and no CartSync", async ({
  page,
}) => {
  await page.addInitScript(
    ([key, lines]) => sessionStorage.setItem(key as string, JSON.stringify(lines)),
    [CART_GUEST_STORAGE_KEY, { lines: [{ slug: "sacuwin-100", qty: 2 }] }] as const,
  );
  // Block the CartSync chunk (the one holding its copy), so only the page itself can start pricing.
  let blocked = 0;
  await page.route("**/_next/static/**/*.js", async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (body.includes("A medicine in your cart is no longer available")) {
      blocked++;
      return route.abort();
    }
    return route.fulfill({ response: res, body });
  });
  await page.goto("/cart");
  await expect(total(page)).toContainText("₹774");
  await expect(page.locator("li.line[data-slug='sacuwin-100'] b.price")).toContainText("₹774");
  // The loader did ask for CartSync, and it never arrived: the page priced the cart by itself.
  await expect.poll(() => blocked, { timeout: 5_000 }).toBeGreaterThan(0);
});

test("/cart: a guest cart, sign-in merge, reload, Remove to empty, and the phone dock", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const email = `e2e-cart-${Date.now()}@example.test`;
  await page.setExtraHTTPHeaders({
    "x-real-ip": `198.51.100.${1 + Math.floor(Math.random() * 254)}`,
  });
  const errors = collectConsoleErrors(page);

  // 1. As a guest, Add then + on the product page: 2 packs at ₹387 each.
  await page.goto("/product/sacuwin-100");
  const ctl = page.locator("main .cart-ctl").first();
  await ctl.getByRole("button", ADD).click();
  await ctl.getByRole("button", { name: "Add one more Sacuwin 100" }).click();
  await expect(ctl.locator(".qty")).toHaveText("2");
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: /Prescription medicines/ })).toBeVisible();
  await expect(total(page)).toHaveText(/Total payable\s*₹774/);

  expect(errors()).toEqual([]);

  // 2. Sign in by email through /login?next=/cart; back on /cart the guest lines were merged.
  // (A new address's verify answers 409 "profile needed", which Chrome logs; that is the login
  // flow's own, so console errors are collected again from /cart on.)
  await page.goto("/login?next=/cart");
  await page.locator('label[for="pg-via-email"]').click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill(await lastCode(request, email));
  await page.getByLabel("Full name").fill("E2E Cart");
  await page.getByRole("checkbox", { name: "I am 18 or older" }).check();
  await page.getByRole("checkbox", { name: /^I agree to the Terms of use/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/cart");
  const errorsAfter = collectConsoleErrors(page);
  const line = page.locator("li.line[data-slug='sacuwin-100']");
  await expect(line.locator(".line-stepper span")).toHaveText("2");
  await expect(page.locator(".receipt a[data-checkout]")).toHaveAttribute("href", "/checkout");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const body = (await (await fetch("/api/cart")).json()) as { lines: { qty: number }[] };
        return body.lines[0]?.qty;
      }),
    )
    .toBe(2);

  // 3. A reload keeps the server cart; at 390 px the dock shows once the receipt scrolls away.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(line.locator(".line-stepper span")).toHaveText("2");
  const dock = page.locator(".dock");
  await page.locator(".receipt a[data-checkout]").scrollIntoViewIfNeeded();
  await expect(dock).not.toHaveClass(/is-shown/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(dock).toHaveClass(/is-shown/);
  await expect(dock).toContainText("₹774");
  await page.evaluate(() => window.scrollTo(0, 0));

  // Remove → the empty state, with focus on its link.
  await page.getByRole("button", { name: "Remove Sacuwin 100 from cart" }).click();
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Browse all \w+ medicines$/ })).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          ((await (await fetch("/api/cart")).json()) as { lines: unknown[] }).lines.length,
      ),
    )
    .toBe(0);
  expect(errorsAfter()).toEqual([]);
});
