import { expect, test } from "@playwright/test";
import { findClaims } from "../tests/helpers/claims";
import { START_PAGES } from "./helpers/pages";

/**
 * The claims guard on the real pages. Component tests run `findClaims` on each section's own
 * text; this runs it on everything a shopper or a crawler reads: the visible text of the whole
 * page (chrome and footer included), its title and its meta description. `allRx: true` because
 * the page tests already prove each Rx-universal line is computed from data; what is checked here
 * is the rest: ratings, guarantees, counts, "therapy" and the Latin specialty names.
 */
for (const path of START_PAGES) {
  test(`copy on ${path} makes no banned claim`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status(), `${path} must exist`).toBe(200);
    const visible = await page.locator("body").innerText();
    const title = await page.title();
    const description =
      (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
    expect(visible.length, "the page has visible text").toBeGreaterThan(200);
    expect(findClaims(visible, { allRx: true }), "visible text").toEqual([]);
    expect(findClaims(title, { allRx: true }), "title").toEqual([]);
    expect(findClaims(description, { allRx: true }), "meta description").toEqual([]);
  });
}

test("a 404 page and its title make no banned claim", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  expect(findClaims(await page.locator("body").innerText(), { allRx: true })).toEqual([]);
  expect(findClaims(await page.title(), { allRx: true })).toEqual([]);
});
