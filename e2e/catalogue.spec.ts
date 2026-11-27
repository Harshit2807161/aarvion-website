import { expect, test } from "@playwright/test";
import { collectConsoleErrors } from "./helpers/console";

test("a product page shows the buy box, price and facts", async ({ page }) => {
  const res = await page.goto("/product/sacuwin-100");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Sacuwin 100" })).toBeVisible();
  await expect(page.locator("[data-hierarchy=pack]")).toContainText("Strip of 14");
  await expect(page.locator("[data-hierarchy=price] .stamp-mrp")).toContainText("MRP ₹407");
  await expect(page.locator("[data-hierarchy=price] .stamp-price")).toContainText("₹387");
  await expect(page.locator("dl.product-facts")).toContainText("Haridwar");
  await expect(page.locator("dl.product-facts")).toContainText("India");
  const photo = page.locator("#photo-1 img");
  expect(await photo.getAttribute("fetchpriority")).toBe("high");
  await expect
    .poll(() => photo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
    .toBe(true);
});

test("the strength switcher moves to another strength's page", async ({ page }) => {
  await page.goto("/product/sacuwin-100");
  const nav = page.getByRole("navigation", { name: "Strengths" });
  await expect(nav.getByRole("link", { name: "100" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "50", exact: true }).click();
  await expect(page).toHaveURL(/\/product\/sacuwin-50$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sacuwin 50");
});

// ensureStatic = "navigation" makes the first hit a real 404, not a streamed 200.
test("an unknown product is a 404 on the first hit", async ({ page }) => {
  const res = await page.goto("/product/nope");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We can’t find that page" })).toBeVisible();
});

test.describe("category pages", () => {
  test("a live category lists its medicines with Add to cart", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto("/category/cardiology");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Heart care" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Add .* to cart$/ })).toHaveCount(5);
    await expect(page.locator("nav.catbar a[aria-current='page']")).toHaveText("Heart care");
    expect(errors()).toEqual([]);
  });

  test("a coming-soon category says so and has no pockets", async ({ page }) => {
    const res = await page.goto("/category/urology");
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Coming soon").first()).toBeVisible();
    await expect(page.locator(".pocket")).toHaveCount(0);
  });

  test("a hidden or unknown category is a 404 with one copy of the store chrome", async ({
    page,
  }) => {
    for (const slug of ["pain-management", "nope"]) {
      const res = await page.goto(`/category/${slug}`);
      expect(res?.status(), slug).toBe(404);
      await expect(
        page.getByRole("heading", { level: 1, name: "We can’t find that page" }),
      ).toBeVisible();
      await expect(page.locator("header")).toHaveCount(1);
      await expect(page.locator("#q")).toHaveCount(1);
    }
  });

  test("the home bento's Heart care tile lands on the category page", async ({ page }) => {
    await page.goto("/");
    await page.locator("#areas a[href='/category/cardiology']").click();
    await expect(page).toHaveURL(/\/category\/cardiology$/);
  });
  test("View all 5 on the home Heart care rail lands on the category page", async ({ page }) => {
    await page.goto("/");
    await page.locator("#heart-care a.rail-all").click();
    await expect(page).toHaveURL(/\/category\/cardiology$/);
  });
});
