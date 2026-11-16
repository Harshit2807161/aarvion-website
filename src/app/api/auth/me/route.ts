import { sessionCookieHeader } from "@/server/auth/cookie";
import { requireUser } from "@/server/auth/guards";
import { toPublicUser } from "@/server/auth/users";
import { jsonResponse, withErrors } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = withErrors(async (req) => {
  const { user, session, token, refreshed } = await requireUser(req);
  const headers: Record<string, string> = {};
  // Sliding customer sessions re-issue the persistent cookie so its Max-Age slides too.
  if (refreshed && session.kind === "customer") {
    headers["Set-Cookie"] = sessionCookieHeader(token, "customer");
  }
  return jsonResponse({ user: toPublicUser(user) }, { headers });
});
