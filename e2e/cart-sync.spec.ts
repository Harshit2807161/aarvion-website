import { expect, test } from "@playwright/test";
import { CART_GUEST_STORAGE_KEY } from "../src/lib/cart/cart";

/**
 * `CartSync` is a lazy chunk (CartSyncLoader). If that chunk fails to load (offline, a flaky
 * network), the loader stays armed and loads it on the next press, key, online or visibility
 * event. The signal that it mounted: its session check finds nobody signed in and drops the
 * guest cart's unsold line, which it says through #live.
 */
const SAID = "A medicine in your cart is no longer available, so it was removed.";

test("CartSync mounts on a key press after its chunk failed to load", async ({ page }) => {
  await page.addInitScript(
    ([key, lines]) => sessionStorage.setItem(key as string, JSON.stringify({ lines })),
    [
      CART_GUEST_STORAGE_KEY,
      [
        { slug: "gone-medicine", qty: 1 },
        { slug: "sacuwin-100", qty: 1 },
      ],
    ] as const,
  );
  let blocked = true;
  let aborted = 0;
  // Abort the chunk that holds CartSync's copy, and only while `blocked`.
  await page.route("**/_next/static/**/*.js", async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (blocked && body.includes(SAID)) {
      aborted++;
      return route.abort();
    }
    return route.fulfill({ response: res, body });
  });

  await page.goto("/");
  await page.waitForTimeout(3_000); // past the loader's 2 s idle timeout
  expect(aborted).toBeGreaterThan(0); // the loader did ask for it, and it failed
  await expect(page.locator("#live")).toHaveText("");
  const stored = () => page.evaluate((k) => sessionStorage.getItem(k), CART_GUEST_STORAGE_KEY);
  expect(await stored()).toContain("gone-medicine");

  blocked = false; // the network is back
  await page.keyboard.press("Shift");
  await expect(page.locator("#live")).toHaveText(SAID);
  expect(await stored()).not.toContain("gone-medicine");
  expect(await stored()).toContain("sacuwin-100");
});
