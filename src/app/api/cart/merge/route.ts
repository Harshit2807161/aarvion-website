import { requireUser, sessionRefreshHeaders } from "@/server/auth/guards";
import { LinesBody, limitCartUser } from "@/server/cart/http";
import { mergeGuestCart } from "@/server/cart/service";
import { getDeps } from "@/server/deps";
import { jsonResponse, readJson, withErrors } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";

/**
 * `POST /api/cart/merge { lines }`: folds the guest cart into the signed-in user's (larger quantity
 * per slug, at most 20 packs). Idempotent, so a retried request changes nothing.
 */
export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const auth = await requireUser(req);
  await limitCartUser(auth);
  const { lines } = await readJson(req, LinesBody);
  const merged = await mergeGuestCart(auth.user._id, lines, getDeps().now());
  return jsonResponse(merged, { headers: sessionRefreshHeaders(auth) });
});
