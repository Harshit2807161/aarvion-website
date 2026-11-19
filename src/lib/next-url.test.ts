import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./next-url.ts";

describe("sanitizeNext", () => {
  it.each(["/checkout", "/product/sacuwin-100?x=1#a", "/%2F%2Fevil.com"])("keeps %s", (p) => {
    expect(sanitizeNext(p)).toBe(p);
  });

  it.each([
    null,
    "",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/x",
    "javascript:alert(1)",
    "/\tevil",
    " /checkout",
    "/login?next=/x",
    "/api/auth/logout",
    "/dev/outbox",
    "/a/../login",
    "/a\\b",
    "/" + "a".repeat(600),
  ])("falls back to / for %j", (p) => {
    expect(sanitizeNext(p)).toBe("/");
  });
});
