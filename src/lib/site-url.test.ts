import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site-url";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("is APP_URL", () => {
    vi.stubEnv("APP_URL", "https://aarvion.in/");
    expect(siteUrl().href).toBe("https://aarvion.in/");
  });

  it("falls back to localhost when APP_URL is unset or invalid", () => {
    vi.stubEnv("APP_URL", "");
    expect(siteUrl().href).toBe("http://localhost:3000/");
    vi.stubEnv("APP_URL", "not a url");
    expect(siteUrl().href).toBe("http://localhost:3000/");
  });

  it("throws in production when APP_URL is missing or invalid, never falling back to localhost", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_URL", "");
    expect(() => siteUrl()).toThrow(/APP_URL/);
    vi.stubEnv("APP_URL", "not a url");
    expect(() => siteUrl()).toThrow(/APP_URL/);
  });
});
