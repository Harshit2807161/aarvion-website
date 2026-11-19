import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/fonts", () => ({ fontVariables: "" }));

import { generateMetadata } from "./layout";

afterEach(() => vi.unstubAllEnvs());

const base = async () => ((await generateMetadata()).metadataBase as URL).href;

describe("root layout metadata", () => {
  it("sets metadataBase from APP_URL so opengraph-image is not localhost", async () => {
    vi.stubEnv("APP_URL", "https://aarvion.example");
    expect(await base()).toBe("https://aarvion.example/");
  });

  it("falls back to the local origin when APP_URL is unset", async () => {
    vi.stubEnv("APP_URL", "");
    expect(await base()).toBe("http://localhost:3000/");
  });

  it("falls back, without throwing, when APP_URL is invalid", async () => {
    vi.stubEnv("APP_URL", "not a url");
    expect(await base()).toBe("http://localhost:3000/");
  });

  it("is not broken by an unrelated invalid env var", async () => {
    vi.stubEnv("APP_URL", "https://aarvion.example");
    vi.stubEnv("OTP_PEPPER", "short");
    vi.stubEnv("VERCEL_ENV", "bogus");
    vi.stubEnv("SMS_PROVIDER", "nope");
    expect(await base()).toBe("https://aarvion.example/");
  });
});
