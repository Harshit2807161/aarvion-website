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

test.describe("overlay on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a short drag or a tap on the head snaps back without replaying the entrance", async ({
    page,
  }) => {
    await page.goto("/dev/styleguide?overlay=dialog");
    const panel = page.getByRole("dialog", { name: "Sign in" });
    await expect(panel).toBeVisible();
    const state = () =>
      panel.evaluate((el) => ({
        animations: el.getAnimations().length,
        transform: getComputedStyle(el).transform,
      }));
    // The entrance has finished before the first drag.
    await expect.poll(async () => (await state()).animations).toBe(0);

    const head = panel.locator(".sheet-head");
    const box = (await head.boundingBox())!;
    const x = box.x + box.width / 2 - 60;
    const y = box.y + 12;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 12, { steps: 4 });
    await page.mouse.up();
    // Snap-back finishes: the transform is back at the identity and nothing is animating
    // (a replayed entrance would show a running animation, and translateY(100%)).
    await expect
      .poll(async () => {
        const s = await state();
        return (
          s.animations === 0 &&
          (s.transform === "none" || s.transform === "matrix(1, 0, 0, 1, 0, 0)")
        );
      })
      .toBe(true);
    await expect(panel).toBeVisible();

    // A plain tap on the grip must not re-arm the entrance either.
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
    expect((await state()).animations).toBe(0);
    await expect(panel).toBeVisible();
  });
});
