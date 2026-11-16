import { describe, expect, it } from "vitest";
import { identifierKey, normalizeEmail, normalizeIdentifier, normalizePhone } from "./identifier";

describe("normalizePhone", () => {
  it.each([
    "9876543210",
    "+91 98765 43210",
    "09876543210",
    "919876543210",
    "+91-98765-43210",
    "(+91) 98765 43210",
  ])("normalizes %s", (raw) => {
    expect(normalizePhone(raw)).toBe("+919876543210");
  });

  it.each(["5876543210", "98765", "+1 2025550123", "+9198765432101", ""])("rejects %j", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Asha.Rao@Example.COM ")).toBe("asha.rao@example.com");
  });
  it("keeps plus-addressing", () => {
    expect(normalizeEmail("asha+rx@example.com")).toBe("asha+rx@example.com");
  });
  it("accepts an address of exactly 254 characters", () => {
    const domain = `${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.com`;
    const addr = `${"a".repeat(64)}@${domain}`;
    expect(addr).toHaveLength(254);
    expect(normalizeEmail(addr)).toBe(addr);
  });
  it("rejects invalid or overlong addresses", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("a@localhost")).toBeNull();
    const long = `${"a".repeat(255 - "@example.com".length)}@example.com`;
    expect(long).toHaveLength(255);
    expect(normalizeEmail(long)).toBeNull();
  });
});

describe("normalizeIdentifier", () => {
  it("builds identifiers and keys", () => {
    const id = normalizeIdentifier("phone", "9876543210");
    expect(id).toEqual({ channel: "phone", value: "+919876543210" });
    expect(identifierKey(id!)).toBe("phone:+919876543210");
    expect(normalizeIdentifier("email", "A@b.com")).toEqual({ channel: "email", value: "a@b.com" });
  });
  it("rejects a value of the wrong channel", () => {
    expect(normalizeIdentifier("phone", "a@b.com")).toBeNull();
    expect(normalizeIdentifier("email", "9876543210")).toBeNull();
  });
});
