import { expect, test, type Page } from "@playwright/test";
import { PENDING_ANCHORS } from "../src/config/routes";

/**
 * Every link to a place on the home page must land on an element. Links come from the skip link,
 * the banner, the quick actions, the category bar, the footer, the rails, the header search form and the 404 page, and
 * each is either `#x` or `/#x`. Anchors a later task builds are in PENDING_ANCHORS and must
 * still be missing, so the task that adds one has to remove its entry.
 */
const pending = new Set<string>(PENDING_ANCHORS);

/** The fragments of the page's links and form actions that point at the home page. */
async function homeFragments(page: Page): Promise<string[]> {
  const fragments = await page.$$eval("a[href], form[action]", (els) =>
    els.flatMap((el) => {
      const raw = el instanceof HTMLFormElement ? el.action : (el as HTMLAnchorElement).href;
      const url = new URL(raw);
      const here = url.origin === location.origin && url.pathname === "/";
      return here && url.hash.length > 1 ? [decodeURIComponent(url.hash.slice(1))] : [];
    }),
  );
  return [...new Set(fragments)];
}

test("every fragment link on / resolves to an element", async ({ page }) => {
  await page.goto("/");
  const fragments = await homeFragments(page);
  // The links the rails and the chrome are known to carry, so an empty crawl cannot pass.
  expect(fragments).toEqual(
    expect.arrayContaining([
      "medicines",
      "heart-care",
      "eye-care",
      "how",
      "questions",
      "faq-win2age",
      "q",
    ]),
  );
  for (const id of fragments) {
    const found = await page.evaluate((x) => document.getElementById(x) !== null, id);
    expect(
      found,
      `#${id} ${pending.has(id) ? "is pending and must stay missing" : "must exist"}`,
    ).toBe(!pending.has(id));
  }
});

test("every pending anchor is still linked from the home page", async ({ page }) => {
  await page.goto("/");
  const fragments = await homeFragments(page);
  // An entry nothing links to is never checked above: delete it, or restore the link.
  for (const id of PENDING_ANCHORS) expect(fragments, `#${id} must be linked`).toContain(id);
});

test("the rails create the category anchors, each once", async ({ page }) => {
  await page.goto("/");
  for (const id of ["medicines", "heart-care", "eye-care", "diabetes-care", "respiratory-care"]) {
    await expect(page.locator(`[id="${id}"]`), `#${id}`).toHaveCount(1);
  }
});

test("the 404 page's links into the home page resolve on the home page", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  const fragments = await homeFragments(page);
  expect(fragments).toContain("medicines");
  await page.goto("/");
  for (const id of fragments.filter((f) => !pending.has(f))) {
    await expect(page.locator(`[id="${id}"]`), `#${id}`).toHaveCount(1);
  }
});
