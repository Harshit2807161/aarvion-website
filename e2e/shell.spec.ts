import { expect, test } from "@playwright/test";
import { collectConsoleErrors } from "./helpers/console";

test("an unknown URL is a 404 inside the store chrome", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "We can’t find that page" }),
  ).toBeVisible();
  await expect(page.locator("[data-announce]")).toBeVisible();
  await expect(page.locator("header[data-store-head]")).toBeVisible();
  await expect(page.locator("nav.catbar")).toBeVisible();
  await expect(page.locator("footer#contact")).toBeVisible();
  const legal = page.locator(".foot-legal dd");
  await expect(legal).toHaveCount(4);
  for (const text of await legal.allTextContents()) expect(text).toBe("To be added");
  await expect(page.locator("#live")).toHaveCount(1);
  expect(errors()).toEqual([]);
});
