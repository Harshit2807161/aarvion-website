import { LinesBody } from "@/server/cart/http";
import { quoteLines } from "@/server/cart/service";
import { capLines } from "@/server/cart/rules";
import { getDeps } from "@/server/deps";
import { HttpError, jsonResponse, readJson, withErrors } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";
import { clientIp, ipBucket } from "@/server/security/client-ip";
import { hitRateLimit } from "@/server/security/rate-limit";

/**
 * `POST /api/cart/quote { lines }`: prices a guest's lines from Mongo. No session, nothing is
 * written. Per IP bucket, 60 a minute.
 */
export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const limited = await hitRateLimit({
    key: `cart-quote:ip:${ipBucket(clientIp(req))}`,
    limit: 60,
    windowMs: 60_000,
    now: getDeps().now(),
  });
  if (!limited.allowed) throw new HttpError(429, "rate_limited", limited.retryAfterSec);
  const { lines } = await readJson(req, LinesBody);
  return jsonResponse(await quoteLines(capLines(lines).lines));
});
