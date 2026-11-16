import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  clearSessionCookieHeader,
  readSessionToken,
  sessionCookieHeader,
} from "./cookie.ts";
import { SESSION_POLICY } from "./sessions.ts";

const TOKEN = "A".repeat(43);
const req = (cookie?: string) =>
  new Request("http://localhost:3000/", cookie ? { headers: { cookie } } : {});

describe("session cookie headers", () => {
  it("names the cookie with the __Host- prefix", () => {
    expect(SESSION_COOKIE).toBe("__Host-aarv_sid");
  });

  it("customer cookie has a 30 day Max-Age", () => {
    expect(sessionCookieHeader(TOKEN, "customer")).toBe(
      `__Host-aarv_sid=${TOKEN}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax`,
    );
  });

  it("staff cookie is a session cookie without Max-Age", () => {
    expect(sessionCookieHeader(TOKEN, "staff")).toBe(
      `__Host-aarv_sid=${TOKEN}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    );
  });

  it("clears the cookie", () => {
    expect(clearSessionCookieHeader()).toBe(
      "__Host-aarv_sid=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
    );
  });
});

describe("readSessionToken", () => {
  it("returns a well-formed token among other cookies", () => {
    expect(readSessionToken(req(`a=1; __Host-aarv_sid=${TOKEN}`))).toBe(TOKEN);
  });

  it.each([
    ["a 42 character value", `__Host-aarv_sid=${"A".repeat(42)}`],
    ["a 44 character value", `__Host-aarv_sid=${"A".repeat(44)}`],
    ["a value containing a dot", `__Host-aarv_sid=${"A".repeat(42)}.`],
    ["no cookie of that name", "a=1; b=2"],
    ["the unprefixed name", `aarv_sid=${TOKEN}`],
    ["an empty value", "__Host-aarv_sid="],
  ])("returns null for %s", (_label, cookie) => {
    expect(readSessionToken(req(cookie))).toBeNull();
  });

  it("returns null without a Cookie header", () => {
    expect(readSessionToken(req())).toBeNull();
  });
});

it("customer cookie Max-Age matches the customer session idle window", () => {
  const max = /Max-Age=(\d+)/.exec(sessionCookieHeader(TOKEN, "customer"))![1];
  expect(Number(max) * 1000).toBe(SESSION_POLICY.customer.idleMs);
});
