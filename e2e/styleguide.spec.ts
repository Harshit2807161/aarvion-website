import { expect, test } from "@playwright/test";

// The e2e build allows mocks, so the dev styleguide renders. The 404 when mocks are forbidden
// is covered by src/proxy.test.ts (the proxy decides before any render).
test("dev styleguide renders every base component", async ({ page }) => {
  const res = await page.goto("/dev/styleguide");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Styleguide", level: 1 })).toBeVisible();
  await expect(page.locator("p.stamp").first()).toBeVisible();
  await expect(page.locator("abbr.rx").first()).toBeVisible();
});

test("a toast speaks through the single polite live region", async ({ page }) => {
  await page.goto("/dev/styleguide");
  await page.getByRole("button", { name: "Show toast" }).click();
  await expect(page.locator(".toast")).toContainText("Added to cart");
  await expect(page.locator("p#live[aria-live='polite']")).toHaveText("Added to cart");
  await expect(page.locator("[aria-live='polite']")).toHaveCount(1);
});
