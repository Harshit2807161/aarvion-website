import { afterEach, describe, expect, it, vi } from "vitest";
import { publicCatalogue } from "../../tests/helpers/catalogue";
import { CATEGORY_LIST } from "@/server/catalogue/categories";

vi.mock("@/lib/catalogue/cached", () => ({
  getCachedProducts: async () => publicCatalogue(),
  getCachedCategories: async () => CATEGORY_LIST.filter((c) => c.status !== "hidden"),
}));
vi.mock("@/fonts", () => ({ fontVariables: "" }));

import { generateMetadata } from "./layout";
import robots from "./robots";
import sitemap from "./sitemap";

afterEach(() => vi.unstubAllEnvs());

describe("sitemap", () => {
  it("lists the home page, live categories, products, policies and contact, as absolute URLs", async () => {
    vi.stubEnv("APP_URL", "https://aarvion.example");
    const urls = (await sitemap()).map((e) => e.url);
    const live = CATEGORY_LIST.filter((c) => c.status === "live");
    expect(urls).toHaveLength(1 + live.length + publicCatalogue().length + 6 + 1);
    expect(urls).toContain("https://aarvion.example/");
    expect(urls).toContain("https://aarvion.example/product/sacuwin-100");
    expect(urls).toContain("https://aarvion.example/category/cardiology");
    expect(urls).toContain("https://aarvion.example/legal/privacy");
    expect(urls).toContain("https://aarvion.example/contact");
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("leaves out coming-soon and hidden categories, login, dev and api", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.filter((u) => /\/(login|dev|api|cart|account)|urology|pain/.test(u))).toEqual([]);
  });
});

describe("robots", () => {
  it("allows crawling in production except the API, dev routes and login, and names the sitemap", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_URL", "https://aarvion.example");
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dev/", "/login"] },
      sitemap: "https://aarvion.example/sitemap.xml",
    });
  });

  it.each(["preview", "development", ""])("disallows everything when VERCEL_ENV is %j", (env) => {
    vi.stubEnv("VERCEL_ENV", env);
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("root metadata", () => {
  it("uses the storefront title and template, with no ₹20 lead", async () => {
    const m = await generateMetadata();
    const title = m.title as { default: string; template: string };
    expect(title.default).toBe("Aarvion Pharmaceuticals · Buy Aarvion medicines online");
    expect(title.template).toBe("%s · Aarvion Pharmaceuticals");
    expect(`${title.default} ${m.description}`).not.toMatch(/₹\s?20/);
  });
});
