import { expect, test } from "@playwright/test";

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

test("an unknown product is a 404", async ({ page }) => {
  const res = await page.goto("/product/nope");
  expect(res?.status()).toBe(404);
});

// The home rails (Task 23+) are not mounted yet, so the pockets are reached through the styleguide.
test("a pocket name leads to its product page", async ({ page }) => {
  await page.goto("/dev/styleguide");
  await page.locator("#p-sacuwin-100 a.pocket-link").click();
  await expect(page).toHaveURL(/\/product\/sacuwin-100$/);
});
