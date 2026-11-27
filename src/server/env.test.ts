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

  it("defaults FILE_STORE_LOCAL_DIR to .data/files and leaves BLOB_READ_WRITE_TOKEN unset", async () => {
    vi.stubEnv("FILE_STORE_LOCAL_DIR", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const { getEnv, resetEnvForTests } = await import("./env");
    resetEnvForTests();
    expect(getEnv().FILE_STORE_LOCAL_DIR).toBe(".data/files");
    expect(getEnv().BLOB_READ_WRITE_TOKEN).toBeUndefined();
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

describe("getSiteEnv", () => {
  afterEach(() => vi.unstubAllEnvs());
  const load = async () => (await import("./env")).getSiteEnv;

  it("does not throw on import, and returns APP_URL and VERCEL_ENV as given", async () => {
    vi.stubEnv("OTP_PEPPER", "short"); // an unrelated bad variable must not matter
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("APP_URL", " https://aarvion.example ");
    expect((await load())()).toEqual({ appUrl: "https://aarvion.example", vercelEnv: "preview" });
  });

  it("is lenient about APP_URL outside production", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_URL", "");
    expect((await load())()).toEqual({ appUrl: undefined, vercelEnv: undefined });
    vi.stubEnv("APP_URL", "not a url");
    expect((await load())().appUrl).toBe("not a url");
  });

  it("rejects an unknown VERCEL_ENV", async () => {
    vi.stubEnv("VERCEL_ENV", "bogus");
    const fn = await load();
    expect(() => fn()).toThrow(/VERCEL_ENV/);
  });

  it.each(["", "not a url"])("throws in production when APP_URL is %j", async (value) => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_URL", value);
    const fn = await load();
    expect(() => fn()).toThrow(/APP_URL/);
  });

  it.each(["http://aarvion.example", "ftp://aarvion.example", "ws://aarvion.example"])(
    "throws in production when APP_URL is not https: %s",
    async (value) => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("APP_URL", value);
      const fn = await load();
      expect(() => fn()).toThrow(/APP_URL must be set to the site's public https URL/);
    },
  );

  it("still allows an http APP_URL outside production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect((await load())().appUrl).toBe("http://localhost:3000");
  });

  it("accepts a valid APP_URL in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_URL", "https://aarvion.in");
    expect((await load())().vercelEnv).toBe("production");
  });
});
