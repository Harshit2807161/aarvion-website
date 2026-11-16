import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not throw on import when MONGODB_URI is missing", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const mod = await import("./env");
    mod.resetEnvForTests();
    expect(() => mod.getEnv()).not.toThrow();
  });

  it("getEnv() returns defaults", async () => {
    vi.stubEnv("MONGODB_DB", "");
    vi.stubEnv("VERCEL_ENV", "");
    const { getEnv, resetEnvForTests } = await import("./env");
    resetEnvForTests();
    expect(getEnv().MONGODB_DB).toBe("aarvion");
  });

  it("rejects an invalid VERCEL_ENV with the key named", async () => {
    vi.stubEnv("VERCEL_ENV", "staging");
    const { getEnv, resetEnvForTests, EnvError } = await import("./env");
    resetEnvForTests();
    expect(() => getEnv()).toThrow(/VERCEL_ENV/);
    expect(() => getEnv()).toThrow(EnvError);
  });

  it("caches the parsed result until reset", async () => {
    vi.stubEnv("MONGODB_DB", "first");
    const { getEnv, resetEnvForTests } = await import("./env");
    resetEnvForTests();
    expect(getEnv().MONGODB_DB).toBe("first");
    vi.stubEnv("MONGODB_DB", "second");
    expect(getEnv().MONGODB_DB).toBe("first");
    resetEnvForTests();
    expect(getEnv().MONGODB_DB).toBe("second");
  });
});

describe("requireEnv", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws an EnvError naming the key when unset", async () => {
    vi.stubEnv("OTP_PEPPER", "");
    const { requireEnv, resetEnvForTests, EnvError } = await import("./env");
    resetEnvForTests();
    expect(() => requireEnv("OTP_PEPPER")).toThrow(/OTP_PEPPER/);
    expect(() => requireEnv("OTP_PEPPER")).toThrow(EnvError);
  });

  it("returns the value when set", async () => {
    vi.stubEnv("OTP_PEPPER", "z".repeat(40));
    const { requireEnv, resetEnvForTests } = await import("./env");
    resetEnvForTests();
    expect(requireEnv("OTP_PEPPER")).toBe("z".repeat(40));
  });

  it("throws naming OTP_PEPPER when it is shorter than 32 characters", async () => {
    vi.stubEnv("OTP_PEPPER", "x".repeat(31));
    const { requireEnv, getEnv, resetEnvForTests } = await import("./env");
    resetEnvForTests();
    expect(() => requireEnv("OTP_PEPPER")).toThrow(/OTP_PEPPER/);
    expect(() => getEnv()).toThrow(/OTP_PEPPER/);
  });
});
