import { SendOtpBody, sendOtp } from "@/server/auth/login";
import { getDeps } from "@/server/deps";
import { HttpError, jsonResponse, readJson, withErrors } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";
import { clientIp, ipBucket } from "@/server/security/client-ip";

export const dynamic = "force-dynamic";

export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const body = await readJson(req, SendOtpBody);
  const result = await sendOtp({
    channel: body.channel,
    identifier: body.identifier,
    ipBucket: ipBucket(clientIp(req)),
    now: getDeps().now(),
  });
  if (result.ok) return jsonResponse({ ok: true, resendAfterSec: result.resendAfterSec });
  switch (result.error) {
    case "invalid_identifier":
      throw new HttpError(400, "invalid_identifier");
    case "resend_cooldown":
    case "rate_limited":
      throw new HttpError(429, result.error, result.retryAfterSec);
    case "delivery_failed":
      throw new HttpError(503, "delivery_failed");
  }
});
