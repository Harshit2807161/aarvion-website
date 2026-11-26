import { describe, expect, it } from "vitest";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "@/server/auth/otp";
import { RESEND_AFTER_SEC } from "@/server/auth/login";
import { CODE_TTL_MS, LOGIN_COPY, MAX_TRIES, RESEND_SEC, mmss, waitText } from "./login-copy.ts";

describe("constants", () => {
  it("match the server", () => {
    expect(MAX_TRIES).toBe(OTP_MAX_ATTEMPTS);
    expect(CODE_TTL_MS).toBe(OTP_TTL_MS);
    expect(RESEND_SEC).toBe(RESEND_AFTER_SEC);
  });
});

describe("formatters", () => {
  it("mmss and waitText", () => {
    expect(mmss(30)).toBe("0:30");
    expect(mmss(125)).toBe("2:05");
    expect(waitText(1500)).toBe("25 minutes");
    expect(waitText(3600)).toBe("1 hour");
    expect(waitText(10_800)).toBe("3 hours");
    expect(waitText(3601)).toBe("2 hours");
    expect(waitText(1)).toBe("1 minute");
  });
  it("never print NaN (carry b)", () => {
    for (const bad of [undefined, NaN, Infinity, -5]) {
      expect(mmss(bad)).toBe("a little while");
      expect(waitText(bad)).toBe("a little while");
    }
  });
});

describe("copy", () => {
  it("toasts", () => {
    expect(LOGIN_COPY.signedInToast("Asha")).toBe("Signed in as Asha");
    expect(LOGIN_COPY.signedInToast(null)).toBe("Signed in");
    expect(LOGIN_COPY.newCodeToast("+91 98765 43210")).toBe("New code sent to +91 98765 43210");
  });
});
