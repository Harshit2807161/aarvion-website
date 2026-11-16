import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnv, resetEnvForTests } from "../env";
import { generateOtpCode, hashOtp } from "./otp";

const id = { channel: "phone", value: "+919876543210" } as const;
const pepper = "p".repeat(64);

beforeEach(() => {
  vi.stubEnv("OTP_PEPPER", pepper);
  resetEnvForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvForTests();
});

describe("generateOtpCode", () => {
  it("always yields six digits", () => {
    for (let n = 0; n < 1000; n++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
});

describe("hashOtp", () => {
  const base = { challengeId: "c1", identifier: id, code: "123456" };
  it("is a stable 64-char hex string", () => {
    const h = hashOtp(base);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtp(base)).toBe(h);
  });
  it("changes with challengeId, code, identifier and pepper", () => {
    const h = hashOtp(base);
    expect(hashOtp({ ...base, challengeId: "c2" })).not.toBe(h);
    expect(hashOtp({ ...base, code: "123457" })).not.toBe(h);
    expect(hashOtp({ ...base, identifier: { channel: "email", value: "a@b.com" } })).not.toBe(h);
    vi.stubEnv("OTP_PEPPER", "q".repeat(64));
    resetEnvForTests();
    expect(hashOtp(base)).not.toBe(h);
  });
  it("throws naming OTP_PEPPER when unset", () => {
    vi.stubEnv("OTP_PEPPER", "");
    resetEnvForTests();
    expect(() => hashOtp(base)).toThrow(/OTP_PEPPER/);
  });
  it("rejects a 31-character pepper at env parse", () => {
    vi.stubEnv("OTP_PEPPER", "x".repeat(31));
    resetEnvForTests();
    expect(() => getEnv()).toThrow(/OTP_PEPPER/);
  });
});
