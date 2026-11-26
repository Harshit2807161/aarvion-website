import { expect, test, type Page } from "@playwright/test";
import { collectConsoleErrors } from "./helpers/console";

/** The scroll film on `/`: pinned acts under motion, the static composition under reduced motion. */
const num = (page: Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el, p) => Number(getComputedStyle(el).getPropertyValue(p)), prop);

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(30);
  }
}

test.describe("film with motion at 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });

  test("pins the ordering act and runs its steps from ?p=3:0.5", async ({ page }) => {
    await page.goto("/?p=3:0.5");
    await expect(page.locator("#home")).toHaveClass(/(^|\s)film(\s|$)/);
    const how = await page.locator("#how").boundingBox();
    const vh = await page.evaluate(() => innerHeight);
    expect(how!.height).toBeGreaterThan(2.9 * vh);
    await expect(page.locator(".step").nth(1)).toHaveClass(/is-active/);
    await expect.poll(() => num(page, ".perf-fill", "--ti")).toBeGreaterThan(0.5);
  });

  test("raises the category tiles from ?p=4:0.3", async ({ page }) => {
    await page.goto("/?p=4:0.3");
    await expect(page.locator("#home")).toHaveClass(/(^|\s)film(\s|$)/);
    const lowest = () =>
      page
        .locator(".tile")
        .evaluateAll((els) => Math.min(...els.map((el) => Number(getComputedStyle(el).opacity))));
    await expect.poll(lowest).toBeGreaterThan(0.3);
  });

  test("lands the logo and the call to action at ?p=5:1", async ({ page }) => {
    await page.goto("/?p=5:1");
    await expect(page.locator("#home")).toHaveClass(/(^|\s)film(\s|$)/);
    await expect
      .poll(() =>
        page.locator(".close-copy").evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBeGreaterThan(0.95);
    const scale = await page
      .locator(".close-swoosh")
      .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
    expect(scale).toBeCloseTo(1, 1);
  });

  test("scrolls top to bottom with no console or page error", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/");
    await scrollThrough(page);
    expect(errors()).toEqual([]);
  });
});

test.describe("film under reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("keeps the static composition: no film class, a short ordering act, nothing hidden", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/?p=3:0.5");
    await expect(page.locator("#home")).not.toHaveClass(/(^|\s)film(\s|$)/);
    const how = await page.locator("#how").boundingBox();
    const vh = await page.evaluate(() => innerHeight);
    expect(how!.height).toBeLessThan(1.2 * vh);
    for (const sel of [".tile", ".close-copy", ".close-swoosh", ".vis-rx"]) {
      await expect(page.locator(sel).first()).toHaveCSS("opacity", "1");
    }
    await scrollThrough(page);
    expect(errors()).toEqual([]);
  });
});
