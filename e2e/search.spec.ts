import { expect, test } from "@playwright/test";
import { collectConsoleErrors } from "./helpers/console";

/**
 * The header search on real pages: Enter on a result lands on its `/product/<slug>` page.
 */
test.describe("header search at 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("on a policy page, valsartan gives 3 options and Enter goes to the product page", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/legal/privacy");
    const q = page.locator("#q");
    await q.click();
    await expect(page.locator(".sugg-panel")).toBeVisible();
    await expect(page.getByText("Type a brand such as Sacuwin")).toBeVisible();
    await q.fill("valsartan");
    await expect(page.getByRole("option")).toHaveCount(3);
    await q.press("Enter");
    await expect(page).toHaveURL(/\/product\/sacuwin-50$/);
    expect(errors()).toEqual([]);
  });

  test("a strength chip narrows the results", async ({ page }) => {
    await page.goto("/legal/privacy");
    await page.locator("#q").click();
    await page.getByRole("button", { name: "100", exact: true }).click();
    await expect(page.getByRole("button", { name: "100", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("option").first()).toContainText("100");
  });

  test("on the home page, mucohelp scrolls its pocket into view and focuses Add to cart", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#p-mucohelp")).toHaveCount(1);
    const q = page.locator("#q");
    await q.click();
    await q.fill("mucohelp");
    await expect(page.getByRole("option").first()).toBeVisible();
    await q.press("Enter");
    await expect(page.locator("#p-mucohelp")).toHaveClass(/is-found/);
    await expect(page.getByRole("button", { name: "Add Mucohelp to cart" })).toBeFocused();
    await expect(page.locator("#p-mucohelp")).toBeInViewport();
  });

  test("Escape closes the list, then clears the field", async ({ page }) => {
    await page.goto("/legal/privacy");
    const q = page.locator("#q");
    await q.fill("sacu");
    await expect(page.getByRole("option").first()).toBeVisible();
    await q.press("Escape");
    await expect(page.locator(".sugg-panel")).toBeHidden();
    await expect(q).toHaveValue("sacu");
    await q.press("Escape");
    await expect(q).toHaveValue("");
  });

  test("the quick-actions card focuses the search", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-search]").first().click();
    await expect(page.locator("#q")).toBeFocused();
  });
});

test.describe("header search at 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the full-width search under the logo row works the same", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#p-mucohelp")).toHaveCount(1);
    const q = page.locator("#q");
    const box = await q.boundingBox();
    const logo = await page.locator(".brand").first().boundingBox();
    expect(box!.y).toBeGreaterThan(logo!.y + logo!.height - 1);
    await q.click();
    await q.fill("mucohelp");
    await expect(page.getByRole("option").first()).toBeVisible();
    await q.press("Enter");
    await expect(page.getByRole("button", { name: "Add Mucohelp to cart" })).toBeFocused();
    await expect(page.locator("#p-mucohelp")).toBeInViewport();
  });
});

test.describe("header search code loading", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the combobox code is not in the first load and arrives on focus", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", (r) => {
      if (r.request().resourceType() === "script") scripts.push(r.url());
    });
    await page.goto("/legal/privacy", { waitUntil: "load" });
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(page.locator("#q")).toBeVisible();
    const before = scripts.length;
    await page.locator("#q").focus();
    await expect(page.getByRole("combobox")).toBeVisible();
    expect(scripts.length).toBeGreaterThan(before);
  });

  test("text typed before the code loads is kept, with the caret and focus", async ({ page }) => {
    // Hold every script back so the plain field is all there is while typing.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/_next\/static\/chunks\/.*\.js/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto("/legal/privacy", { waitUntil: "domcontentloaded" });
    const q = page.locator("#q");
    await q.click();
    await page.keyboard.type("sacuwin");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    release();
    const box = page.getByRole("combobox");
    await expect(box).toBeVisible();
    await expect(box).toHaveValue("sacuwin");
    await expect(box).toBeFocused();
    const caret = await box.evaluate((el: HTMLInputElement) => el.selectionStart);
    expect(caret).toBe(5);
    await expect(page.getByRole("option").first()).toBeVisible();
  });
});
