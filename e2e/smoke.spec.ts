import { expect, test } from "@playwright/test";

test("home page renders the brand", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Aarvion/ })).toBeVisible();
});

test("health endpoint is ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok", db: "skipped" });
});
