import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/fonts", () => ({ fontVariables: "" }));
vi.mock("@/lib/catalogue/cached", () => ({
  getCachedCategories: vi.fn(async () => [
    { slug: "cardiology", name: "Heart care", status: "live", sortOrder: 0 },
    { slug: "urology", name: "Urinary care", status: "coming_soon", sortOrder: 5 },
  ]),
}));

import type { ReactElement } from "react";
import { StoreFooter } from "@/components/shell/store-footer";
import RootLayout, { generateMetadata } from "./layout";

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

describe("root layout", () => {
  it("renders the footer after the children with only the live categories", async () => {
    const html = (await RootLayout({ children: "page" })) as ReactElement<{
      children: ReactElement;
    }>;
    const body = html.props.children as ReactElement<{ children: ReactElement[] }>;
    const [page, footer] = body.props.children as [
      string,
      ReactElement<{ categories: { slug: string }[] }>,
    ];
    expect(page).toBe("page");
    expect(footer.type).toBe(StoreFooter);
    expect(footer.props.categories.map((c) => c.slug)).toEqual(["cardiology"]);
  });
});
