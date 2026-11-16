import { appendAudit } from "@/server/audit";
import { clearSessionCookieHeader, readSessionToken } from "@/server/auth/cookie";
import { getAuth } from "@/server/auth/guards";
import { revokeSession } from "@/server/auth/sessions";
import { getDeps } from "@/server/deps";
import { withErrors } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";

export const dynamic = "force-dynamic";

export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const now = getDeps().now();
  const auth = await getAuth(req, now);
  // Revoke first, even when the user lookup failed: any presented token is dropped, and a
  // failing audit write can never leave the session alive.
  const token = readSessionToken(req);
  if (token) await revokeSession(token);
  if (auth) {
    try {
      await appendAudit({
        at: now,
        action: "auth.logout",
        actor: { type: "user", userId: auth.user._id, role: auth.user.role },
      });
    } catch (err) {
      console.error("audit write failed", err instanceof Error ? err.name : "unknown");
    }
  }
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "Set-Cookie": clearSessionCookieHeader() },
  });
});
