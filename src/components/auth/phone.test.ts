import { describe, expect, it } from "vitest";
import { EMAIL_RE, MOBILE_RE, formatMobile, normMobile } from "./phone.ts";

describe("normMobile", () => {
  it.each(["+91 98765 43210", "09876543210", "919876543210", "98765-43210"])("%s", (raw) => {
    expect(normMobile(raw)).toBe("9876543210");
  });

  it("keeps a short number as typed", () => {
    expect(normMobile("98765")).toBe("98765");
  });

  it("never truncates, so a mistyped number fails MOBILE_RE", () => {
    for (const raw of ["98765543210", "091 98765 43210", "98765432109999", "98765 432109"]) {
      expect(MOBILE_RE.test(normMobile(raw))).toBe(false);
    }
  });

  it("refuses input with a character that is not a digit or separator, instead of dropping it", () => {
    for (const raw of [
      "98765O43210",
      "९8765432101",
      "９9876543210",
      "9876543210a",
      "98765\u200B43210",
    ]) {
      expect(MOBILE_RE.test(normMobile(raw))).toBe(false);
    }
  });

  it("reads digits of other scripts as the digits typed", () => {
    expect(normMobile("९९९९९९९९९९")).toBe("9999999999");
    expect(normMobile("９８７６５４３２１０")).toBe("9876543210");
    expect(normMobile("+९१ 98765 43210")).toBe("9876543210");
  });

  it("does not strip a leading 91 or 0 from a ten digit number", () => {
    expect(normMobile("9112345678")).toBe("9112345678");
  });
});

describe("formatMobile", () => {
  it("formats with +91 and a space after five digits", () => {
    expect(formatMobile("9876543210")).toBe("+91 98765 43210");
  });
});

describe("regexes", () => {
  it("MOBILE_RE needs ten digits starting 6-9", () => {
    expect(MOBILE_RE.test("9876543210")).toBe(true);
    expect(MOBILE_RE.test("5876543210")).toBe(false);
    expect(MOBILE_RE.test("987654321")).toBe(false);
  });

  it("EMAIL_RE accepts a plain address and rejects obvious typos", () => {
    expect(EMAIL_RE.test("a@b.co")).toBe(true);
    expect(EMAIL_RE.test("a@b")).toBe(false);
    expect(EMAIL_RE.test("a b@c.com")).toBe(false);
  });
});
