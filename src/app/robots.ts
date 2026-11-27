import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { getSiteEnv } from "@/server/env";

/**
 * Production allows crawling except the API, the dev routes and the login page. Every other
 * environment (preview, development, unset) disallows everything, so a preview deploy is never
 * indexed. Production without a valid APP_URL throws (siteUrl), failing the build.
 */
export default function robots(): MetadataRoute.Robots {
  if (getSiteEnv().vercelEnv !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  const base = siteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dev/", "/login"] },
    sitemap: new URL("/sitemap.xml", base).href,
  };
}
