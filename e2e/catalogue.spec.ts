import { expect, test } from "@playwright/test";
import { collectConsoleErrors } from "./helpers/console";

test.describe("category pages", () => {
  test("a live category lists its medicines with Add to cart", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto("/category/cardiology");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Heart care" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Add .* to cart$/ })).toHaveCount(5);
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
});
