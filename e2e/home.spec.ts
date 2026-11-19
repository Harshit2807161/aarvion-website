import { expect, test, type Page } from "@playwright/test";

const hero = (page: Page) => page.locator("section.hero");
const dot = (page: Page, n: number) => page.locator(".hero-dot").nth(n - 1);

test.describe("home banner with motion at 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });

  test("moves from slide 1 to slide 2 within 7 s of starting, with no hydration error", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /hydrat|Minified React error/i.test(m.text()))
        errors.push(m.text());
    });
    await page.goto("/");
    await expect(hero(page)).toHaveClass(/is-auto/);
    await expect(dot(page, 1)).toHaveAttribute("aria-current", "true");
    // Polled every frame: expect's back-off polls once a second by then, which would see the
    // 6 s advance only near the 7 s bound.
    await page.waitForFunction(
      () => document.querySelectorAll(".hero-dot")[1]?.getAttribute("aria-current") === "true",
      null,
      { timeout: 7_000 },
    );
    await expect(dot(page, 1)).not.toHaveAttribute("aria-current");
    expect(errors).toEqual([]);
  });

  test("holds while the pointer is over the banner", async ({ page }) => {
    await page.goto("/");
    await expect(hero(page)).toHaveClass(/is-auto/);
    await page.locator(".hero-track").hover();
    await expect(hero(page)).toHaveClass(/is-held/);
    await page.waitForTimeout(8_000);
    await expect(dot(page, 1)).toHaveAttribute("aria-current", "true");
  });

  test("Next, focused from the keyboard, shows slide 2 on Enter", async ({ page }) => {
    await page.goto("/");
    await expect(hero(page)).toHaveClass(/is-ready/);
    await page.getByRole("button", { name: "Next slide" }).focus();
    await page.keyboard.press("Enter");
    await expect(dot(page, 2)).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("group", { name: "2 of 4" })).toHaveClass(/is-current/);
    await expect(
      page.getByRole("heading", { name: "Eye drops, delivered to your door" }),
    ).toBeVisible();
  });
});

test.describe("home banner under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("stays on slide 1 and hides the pause control", async ({ page }) => {
    await page.goto("/");
    await expect(hero(page)).toHaveClass(/is-ready/);
    await page.waitForTimeout(7_000);
    await expect(dot(page, 1)).toHaveAttribute("aria-current", "true");
    await expect(page.locator("[data-play]")).toBeHidden();
  });
});

test.describe("home banner on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("scrolls horizontally with snap, the next card peeking, slide 1 the eager LCP", async ({
    page,
  }) => {
    await page.goto("/");
    const track = page.locator(".hero-track");
    const style = await track.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        overflowX: s.overflowX,
        snap: s.scrollSnapType,
        scrolls: el.scrollWidth > el.clientWidth,
      };
    });
    expect(style).toEqual({ overflowX: "auto", snap: "x mandatory", scrolls: true });
    const second = await page.getByRole("group", { name: "2 of 4" }).boundingBox();
    expect(second!.x).toBeLessThan(390);
    const lead = page.locator(".slide").first().locator("img");
    await expect(lead).toHaveAttribute("fetchpriority", "high");
    await expect(lead).toHaveAttribute("loading", "eager");
    await expect
      .poll(() => lead.evaluate((img: HTMLImageElement) => img.currentSrc))
      .toContain("sacuwin-m.webp");
  });
});
