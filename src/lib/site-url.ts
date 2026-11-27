import { resolveSiteMetadataBase } from "@/config/site";
import { getSiteEnv } from "@/server/env";

/**
 * The site's public origin: `APP_URL`, else http://localhost:3000. In production (VERCEL_ENV) a
 * missing or invalid `APP_URL` throws an EnvError, so a deploy never publishes localhost
 * canonicals, sitemap URLs or structured data (docs/decisions/environments.md). Server-only
 * (listed in SERVER_ONLY_LIB); it throws when called, never at import.
 */
export function siteUrl(): URL {
  return resolveSiteMetadataBase(getSiteEnv().appUrl);
}
