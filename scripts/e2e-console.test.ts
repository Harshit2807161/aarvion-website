import { describe, expect, it } from "vitest";
import { isExpectedNotFound } from "../e2e/helpers/console";

// Lives in scripts/ because Vitest's `unit` project does not include e2e/ (and Playwright
// would try to run a *.test.ts under e2e/).
const PAGE = "http://localhost:3100/no-such-page";
const text = (status: number) =>
  `Failed to load resource: the server responded with a status of ${status} (Not Found)`;

describe("isExpectedNotFound", () => {
  it("ignores the page's own 404", () => {
    expect(isExpectedNotFound(PAGE, text(404), PAGE)).toBe(true);
  });

  it("keeps the page's own 500", () => {
    expect(isExpectedNotFound(PAGE, text(500), PAGE)).toBe(false);
  });

  it("ignores the _rsc prefetch 404 of a pending route", () => {
    expect(isExpectedNotFound(PAGE, text(404), "http://localhost:3100/checkout?_rsc=abc")).toBe(true);
  });

  it("keeps a 500 prefetch of a pending route", () => {
    expect(isExpectedNotFound(PAGE, text(500), "http://localhost:3100/checkout?_rsc=abc")).toBe(false);
  });

  it("keeps a 404 prefetch of a route that is not pending", () => {
    expect(isExpectedNotFound(PAGE, text(404), "http://localhost:3100/product/x?_rsc=abc")).toBe(
      false,
    );
  });

  it("keeps a 404 for any other asset, and any other message", () => {
    expect(isExpectedNotFound(PAGE, text(404), "http://localhost:3100/missing.png")).toBe(false);
    expect(isExpectedNotFound(PAGE, "Uncaught TypeError", PAGE)).toBe(false);
  });
});
