import { connection } from "next/server";
import { getCachedProducts } from "@/lib/catalogue/cached";
import { SEARCH_LIMIT, STRENGTH_RE, searchProducts } from "@/lib/catalogue/search-result";
import { MAX_QUERY_LENGTH } from "@/server/catalogue/search";
import { getDeps } from "@/server/deps";
import { HttpError, jsonResponse, withErrors } from "@/server/http";
import { clientIp, ipBucket } from "@/server/security/client-ip";
import { hitRateLimit } from "@/server/security/rate-limit";

/**
 * Header search: `GET /api/products?q=&strength=`. Reads the cached catalogue (never the DB per
 * request), filters in shelf order and returns at most 20 hits. The response is `no-store` and
 * per-IP rate limited. The query text is never logged: a search for a medicine can be health data.
 */
export const GET = withErrors(async (req) => {
  await connection();
  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const strength = params.get("strength");
  if (q.length > MAX_QUERY_LENGTH) throw new HttpError(400, "query_too_long");
  if (strength !== null && !STRENGTH_RE.test(strength))
    throw new HttpError(400, "invalid_strength");

  const limited = await hitRateLimit({
    key: `search:ip:${ipBucket(clientIp(req))}`,
    ...SEARCH_LIMIT,
    now: getDeps().now(),
  });
  if (!limited.allowed) throw new HttpError(429, "rate_limited", limited.retryAfterSec);

  return jsonResponse({ results: searchProducts(await getCachedProducts(), q, strength) });
});
