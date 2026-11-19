import type { Page } from "@playwright/test";
import { PENDING_ROUTES } from "../../src/config/routes";

/**
 * Chrome logs "Failed to load resource ... 404" for two things that are not errors in the page:
 * the page's own URL when the page is itself a 404 or 500, and the router's `?_rsc=` prefetch of
 * a route the chrome links to but no task has built yet (PENDING_ROUTES, which shrinks as the
 * pages land). A failing image, script or any other route is still collected.
 */
function isExpectedNotFound(page: Page, text: string, url: string): boolean {
  if (!text.startsWith("Failed to load resource")) return false;
  if (url === page.url()) return true;
  const { pathname, searchParams } = new URL(url);
  return searchParams.has("_rsc") && (PENDING_ROUTES as readonly string[]).includes(pathname);
}

/**
 * Start recording the page's console errors and uncaught page errors. Call it before
 * `page.goto`; call the returned function at the end of the test to read what was collected
 * (`expect(errors()).toEqual([])`). Only the message text is kept.
 */
export function collectConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (!isExpectedNotFound(page, msg.text(), msg.location().url)) errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return () => [...errors];
}
