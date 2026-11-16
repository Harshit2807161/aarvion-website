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
    await expect(import("./env")).resolves.toBeDefined();
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
