import { requireUser, sessionRefreshHeaders } from "@/server/auth/guards";
import { getDeps } from "@/server/deps";
import { HttpError, jsonResponse, withErrors } from "@/server/http";
import { startRxUpload } from "@/server/prescriptions/upload";
import { clientIp, ipBucket } from "@/server/security/client-ip";
import { assertSameOrigin } from "@/server/security/origin";

/**
 * `POST /api/prescriptions/staging`: issues a single-use upload slot (15 minutes). 201
 * `{ stagingId, mode, pathname }`: `direct` means PUT the bytes to `/api/prescriptions/staging/<id>`,
 * `client-token` means upload them to Blob at exactly `pathname` (token from `blob-token`).
 */
export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const auth = await requireUser(req);
  const started = await startRxUpload({
    userId: auth.user._id,
    ipBucket: ipBucket(clientIp(req)),
    now: getDeps().now(),
  });
  if (!started.ok) throw new HttpError(429, "rate_limited", started.retryAfterSec);
  return jsonResponse(
    { stagingId: started.stagingId, mode: started.mode, pathname: started.key },
    { status: 201, headers: sessionRefreshHeaders(auth) },
  );
});
