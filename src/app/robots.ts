import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * Production allows crawling except the API, the dev routes and the login page. Every other
 * environment (preview, development, unset) disallows everything, so a preview deploy is never
 * indexed. Read from the raw variable: robots must answer even if an unrelated variable is bad.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  if (process.env.VERCEL_ENV !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dev/", "/login"] },
    sitemap: new URL("/sitemap.xml", base).href,
  };
}
