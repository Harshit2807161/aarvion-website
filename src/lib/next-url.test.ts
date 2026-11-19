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
    "/.//evil.com",
    "/..//evil.com",
    "/a/..//evil.com",
    "/%2e//evil.com",
    "/%2E%2E//evil.com",
    "/%2e%2e//evil.com",
    "/.//evil.com/x?y#z",
    "/LOGIN",
    "/./login",
    "/x/../api/auth/logout",
    "/%6Cogin",
    "/%6cogin/%ZZ",
    "/%61pi/auth/logout%ff",
    "/API/auth/logout",
    "/" + "a".repeat(600),
  ])("falls back to / for %j", (p) => {
    expect(sanitizeNext(p)).toBe("/");
  });
});
