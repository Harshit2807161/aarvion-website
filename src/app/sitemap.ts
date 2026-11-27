import type { MetadataRoute } from "next";
import { ROUTES } from "@/config/routes";
import { getCachedCategories, getCachedProducts } from "@/lib/catalogue/cached";
import { siteUrl } from "@/lib/site-url";

/**
 * Every indexable URL: the home page, the live categories and live products (the cached
 * catalogue already holds only live ones' products), the policies and contact. Never /login,
 * /dev, /api, the cart or the account pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [categories, products] = await Promise.all([getCachedCategories(), getCachedProducts()]);
  const paths = [
    ROUTES.home,
    ...categories.filter((c) => c.status === "live").map((c) => ROUTES.category(c.slug)),
    ...products.map((p) => ROUTES.product(p.slug)),
    ...Object.values(ROUTES.legal),
    ROUTES.contact,
  ];
  return paths.map((path) => ({ url: new URL(path, base).href }));
}
