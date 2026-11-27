import { expect, test } from "@playwright/test";
import { collectConsoleErrors } from "./helpers/console";

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

  // A slug that was not prerendered streams (PPR): its first response is 200 and carries the
  // not-found page with `noindex`; once rendered, the URL answers 404. Warm it, then check that.
  test("a hidden or unknown category is the 404 page with the store chrome", async ({ page }) => {
    for (const slug of ["pain-management", "nope"]) {
      await page.goto(`/category/${slug}`);
      await expect(
        page.getByRole("heading", { level: 1, name: "We can’t find that page" }),
      ).toBeVisible();
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        "content",
        /noindex/,
      );
      const again = await page.goto(`/category/${slug}`);
      expect(again?.status(), slug).toBe(404);
      // Known: the root not-found adds its own chrome inside the store layout, so it shows twice.
      await expect(page.locator("nav.catbar").first()).toBeVisible();
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
