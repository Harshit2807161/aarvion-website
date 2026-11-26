import { expect, test } from "@playwright/test";
import { PENDING_ROUTES, ROUTES } from "../src/config/routes";

/**
 * Site-wide link check. Starting from each page below, every same-origin `a[href]` (hash
 * stripped, deduped) must return 200, except a path in PENDING_ROUTES, which must still 404.
 * Later tasks (32, 42) add their pages to START.
 */
const START: string[] = [
  "/",
  ROUTES.category("cardiology"),
  ROUTES.category("urology"),
  ROUTES.contact,
  ...Object.values(ROUTES.legal),
];

const pending = new Set<string>(PENDING_ROUTES);

for (const start of START) {
  test(`links on ${start} resolve`, async ({ page, request }) => {
    const first = await page.goto(start);
    // A start page owned by a sibling PR that has not landed yet would 404 here; say so clearly.
    expect(first?.status(), `${start} must exist`).toBe(200);

    const hrefs = await page.$$eval("a[href]", (as) =>
      as.map((a) => (a as HTMLAnchorElement).href),
    );
    const paths = new Set<string>();
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== new URL(page.url()).origin) continue;
      paths.add(url.pathname + url.search);
    }
    expect(paths.size, "page has same-origin links").toBeGreaterThan(0);

    for (const path of paths) {
      const res = await request.get(path);
      const expected = pending.has(new URL(path, "http://x").pathname) ? 404 : 200;
      expect(res.status(), `${start} links to ${path}`).toBe(expected);
    }
  });
}
