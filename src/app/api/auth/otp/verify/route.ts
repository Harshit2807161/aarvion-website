import { sessionCookieHeader, readSessionToken } from "@/server/auth/cookie";
import { VerifyOtpBody, verifyOtpAndLogin } from "@/server/auth/login";
import { getDeps } from "@/server/deps";
import { HttpError, jsonResponse, readJson, withErrors } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";
import { clientIp, ipBucket } from "@/server/security/client-ip";

export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const body = await readJson(req, VerifyOtpBody);
  const result = await verifyOtpAndLogin({
    channel: body.channel,
    identifier: body.identifier,
    code: body.code,
    signup: body.signup,
    ipBucket: ipBucket(clientIp(req)),
    existingToken: readSessionToken(req),
    now: getDeps().now(),
  });
  if (result.ok) {
    return jsonResponse(
      { user: result.user, isNewUser: result.isNewUser },
      { headers: { "Set-Cookie": sessionCookieHeader(result.token, result.kind) } },
    );
  }
  switch (result.error) {
    case "too_many_attempts":
    case "rate_limited":
      throw new HttpError(429, result.error, result.retryAfterSec);
    case "invalid_code":
      throw new HttpError(400, "invalid_code");
    // The code was right but the identifier is new: the client asks for the sign-up details.
    case "signup_required":
      throw new HttpError(409, "signup_required");
  }
});
