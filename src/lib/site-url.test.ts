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
});
