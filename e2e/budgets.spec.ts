import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  emulateMobile,
  measureLcp,
  readCls,
  resourceBytes,
  scriptBytes,
  watchCls,
} from "./helpers/perf";

/**
 * Home performance budgets (UI plan, Performance budgets). The LCP element is banner slide 1:
 * eager with fetchPriority high, never a preload. The only image the HTML preloads is the header
 * logo (the footer logo is lazy). Thresholds are the plan's; if one fails, fix the page.
 */
const SLOW_START = { timeout: 60_000 };

/** One unthrottled visit in its own context, so the server's image cache is warm but the browser's is not. */
async function warm(browser: Browser, viewport: { width: number; height: number }, dpr: number) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto("/", { waitUntil: "load" });
  await ctx.close();
}

async function lcpAfterWarmVisit(browser: Browser, page: Page, w: number, h: number, dpr: number) {
  await warm(browser, { width: w, height: h }, dpr);
  if (w < 720) await emulateMobile(page);
  await page.goto("/", { waitUntil: "load" });
  return measureLcp(page);
}

for (const [w, h, dpr] of [
  [390, 844, 2],
  [1440, 900, 1],
] as const) {
  test.describe(`home at ${w}`, () => {
    test.use({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });

    test("LCP is banner slide 1, eager, under 2.5 s", async ({ browser, page }) => {
      test.setTimeout(SLOW_START.timeout);
      const lcp = await lcpAfterWarmVisit(browser, page, w, h, dpr);
      expect(lcp.tag).toBe("IMG");
      expect(lcp.src).toContain("banners");
      expect(lcp.lazy).toBe(false);
      expect(lcp.ms).toBeLessThan(2500);
    });

    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      test(`CLS stays under 0.1 with motion ${reducedMotion}`, async ({ browser }) => {
        const ctx = await browser.newContext({
          viewport: { width: w, height: h },
          deviceScaleFactor: dpr,
          reducedMotion,
        });
        const page = await ctx.newPage();
        await watchCls(page);
        await page.goto("/", { waitUntil: "load" });
        await page.waitForTimeout(1500);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(500);
        expect(await readCls(page)).toBeLessThan(0.1);
        await ctx.close();
      });
    }
  });
}

test.describe("home on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  test("slide 1's image is at most 60 kB", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const { src } = await measureLcp(page);
    const [entry] = await resourceBytes(
      page,
      new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    expect(entry, "slide 1's image is a resource").toBeDefined();
    expect(entry!.bytes).toBeLessThanOrEqual(60_000);
  });
});

test.describe("home on a phone without JavaScript", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    javaScriptEnabled: false,
  });

  test("the swipeable cards 2 to 4 show a loaded picture, not a blank box", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    for (const n of [2, 3, 4]) {
      const card = page.getByRole("group", { name: `${n} of 4` });
      await card.scrollIntoViewIfNeeded();
      const img = card.locator("img[src]");
      await expect(img).toHaveCount(1);
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
        .toBe(true);
    }
  });
});

test.describe("home loading", () => {
  for (const [w, h, dpr] of [
    [1280, 720, 1],
    [390, 844, 2],
  ] as const) {
    test(`requests none of slides 2 to 4 before load at ${w}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        deviceScaleFactor: dpr,
      });
      const page = await ctx.newPage();
      const early: string[] = [];
      let loaded = false;
      page.on("request", (r) => {
        if (!loaded && /banners(%2F|\/)(eye|rx|delivery)/.test(r.url())) early.push(r.url());
      });
      page.on("load", () => (loaded = true));
      await page.goto("/", { waitUntil: "load" });
      expect(early).toEqual([]);
      await ctx.close();
    });
  }

  test("preloads the header logo as its only image and loads exactly the 3 self-hosted fonts", async ({
    page,
  }) => {
    const fonts: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "font") fonts.push(r.url());
    });
    const res = await page.goto("/", { waitUntil: "load" });
    const links = (res!.headers()["link"] ?? "").split(/,\s*(?=<)/);
    const images = links.filter((l) => /as="?image"?/.test(l));
    expect(images).toHaveLength(1);
    expect(images[0]).toContain("/brand/aarvion-logo.svg");
    // React 19 moves preloads into <head> once the header is full: none may be an image there.
    const headImages = await page.evaluate(() =>
      [...document.querySelectorAll('head link[rel="preload"][as="image"]')].map((l) =>
        l.getAttribute("href"),
      ),
    );
    expect(headImages.filter((h) => !h?.includes("/brand/aarvion-logo.svg"))).toEqual([]);
    // src/fonts holds three subsets (Host Grotesk, Geist, Geist Mono); the plan said four.
    expect(fonts).toHaveLength(3);
    for (const f of fonts) {
      expect(new URL(f).pathname).toMatch(/^\/_next\/static\/media\/.+\.woff2$/);
    }
    expect(fonts.some((f) => /googleapis|gstatic/.test(f))).toBe(false);
    const covered = await page.evaluate(async () => {
      await document.fonts.ready;
      // The primary family only: next/font adds a metric "Fallback" face to the stack that is
      // never downloaded, so checking the whole stack would always report an unloaded face.
      const stack = getComputedStyle(document.querySelector(".stamp-price")!).fontFamily;
      return document.fonts.check(`600 34px ${stack.split(",")[0]}`, "₹387");
    });
    expect(covered).toBe(true);
  });

  test.describe("under reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the banner's current slide is unchanged after 7 s", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      const current = () =>
        page.locator(".hero-dot[aria-current='true']").getAttribute("aria-label");
      const first = await current();
      await page.waitForTimeout(7_000);
      expect(await current()).toBe(first);
    });
  });
});

// First-load JS on `/`, gzipped. The plan's target is 150 kB, but `/` ships about 170 kB today:
// React DOM 73, Next's client 47, the app and runtime about 50. The ruling is a ratchet at 175 kB
// so it can only get smaller; product pages keep 150. Follow-up (filed separately): lazy-load the
// header search island on first focus or idle and trim the hero chunk, then lower this number.
const HOME_JS_BUDGET_BYTES = 175_000;

test("first-load JS on / stays within the 175 kB ratchet (target 150 kB)", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  const { total, count } = await scriptBytes(page);
  // A floor, so a measurement that reads nothing cannot pass.
  expect(count).toBeGreaterThan(5);
  expect(total).toBeGreaterThan(50_000);
  expect(total).toBeLessThanOrEqual(HOME_JS_BUDGET_BYTES);
});

// Product page budgets (UI plan, Performance budgets). First-load JS is a ratchet, like `/`'s:
// the plan's target is 150 kB, but the route ships about 166.5 kB today, and all of it is shared
// framework and chrome, none of it the product page's own code (React DOM 73 kB, Next's client
// 47 kB, the router chunks, the header search island, the cart store and the toaster). The ruling
// is a ratchet at 170 kB so it can only get smaller. The follow-up is lazy-loading the header
// search island (a separate PR); lower this number, and `/`'s, whenever the route shrinks.
const PRODUCT = "/product/sacuwin-100";
const PRODUCT_JS_BUDGET_BYTES = 170_000;

test.describe("product page on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  test("first-load JS stays within the 170 kB ratchet (target 150 kB)", async ({ page }) => {
    await page.goto(PRODUCT, { waitUntil: "load" });
    const { total, count } = await scriptBytes(page);
    expect(count).toBeGreaterThan(5);
    expect(total).toBeGreaterThan(50_000);
    expect(total).toBeLessThanOrEqual(PRODUCT_JS_BUDGET_BYTES);
  });

  test("LCP is the first gallery photo, eager, under 2.5 s", async ({ browser, page }) => {
    test.setTimeout(SLOW_START.timeout);
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    // A visit in a fresh context warms the server and the image optimizer, not this browser's cache.
    const first = await ctx.newPage();
    await first.goto(PRODUCT, { waitUntil: "load" });
    await ctx.close();
    await emulateMobile(page);
    await page.goto(PRODUCT, { waitUntil: "load" });
    const lcp = await measureLcp(page);
    expect(lcp.tag).toBe("IMG");
    expect(lcp.lazy).toBe(false);
    expect(lcp.ms).toBeLessThan(2500);
    const photo = page.locator("#photo-1 img");
    expect(await photo.evaluate((i: HTMLImageElement) => i.currentSrc)).toBe(lcp.src);
  });

  test("the gallery photo is served as AVIF", async ({ page }) => {
    // The browser's own request for photo 1 (its Accept header), not one this test builds.
    const photo = page.waitForResponse(
      (r) => r.url().includes("/_next/image") && r.request().resourceType() === "image",
    );
    await page.goto(PRODUCT, { waitUntil: "load" });
    expect((await photo).headers()["content-type"]).toBe("image/avif");
  });

  test("CLS stays under 0.1", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await watchCls(page);
    await page.goto(PRODUCT, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    expect(await readCls(page)).toBeLessThan(0.1);
    await ctx.close();
  });
});
