import { resolveSiteMetadataBase } from "@/config/site";

/**
 * The site's public origin: `APP_URL`, else http://localhost:3000. It reads the raw variable (not
 * getEnv) for the same reason the root layout does: a bad unrelated variable must not take down
 * every page. `APP_URL` is required on Vercel (docs/decisions/environments.md), otherwise the
 * sitemap, canonical links and structured data point at localhost.
 */
export function siteUrl(): URL {
  return resolveSiteMetadataBase(process.env.APP_URL);
}
