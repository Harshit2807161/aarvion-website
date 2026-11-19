// Full-page screenshots of a local HTML file or URL at given widths.
// Usage: node scripts/shoot.mjs <file[?query]|url> <out-prefix> [widths=1440,390] [--viewport-only] [--motion]
//   --viewport-only  capture only the first viewport
//   --motion         run with reducedMotion "no-preference" (default is "reduce")
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [target, outPrefix, widthsArg = "1440,390"] = args.filter((a) => !a.startsWith("--"));
if (!target || !outPrefix) {
  console.error("usage: node scripts/shoot.mjs <file[?query]|url> <out-prefix> [widths] [--viewport-only] [--motion]");
  process.exit(2);
}
const viewportOnly = flags.has("--viewport-only");
// A local file may carry ?query (and #hash); split it off before resolving the path.
const toUrl = (t) => {
  if (/^https?:/.test(t)) return t;
  const [, file, suffix = ""] = t.match(/^([^?#]*)(.*)$/);
  return pathToFileURL(path.resolve(file)).href + suffix;
};
const url = toUrl(target);
const browser = await chromium.launch();
for (const w of widthsArg.split(",").map(Number)) {
  const h = w < 600 ? 844 : 900;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 600 ? 2 : 1, reducedMotion: flags.has("--motion") ? "no-preference" : "reduce" });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(400);
  // lazy images are switched to eager by the page after 300ms; wait for them to land
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(150);
  if (!viewportOnly) {
    // walk the page once so every image is decoded before the full-page capture
    await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); } scrollTo(0, 0); });
    await page.waitForTimeout(300);
  }
  const out = `${outPrefix}-${w}.png`;
  await page.screenshot({ path: out, fullPage: !viewportOnly });
  console.log("wrote", out);
  await page.close();
}
await browser.close();
