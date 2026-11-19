import { connection } from "next/server";
import { sessionCookieHeader } from "@/server/auth/cookie";
import { getAuth } from "@/server/auth/guards";
import { toPublicUser } from "@/server/auth/users";
import { getDeps } from "@/server/deps";
import { jsonResponse, withErrors } from "@/server/http";

/**
 * The header's auth state, fetched after hydration so pages stay static. Always 200 (never 401)
 * with the public user or null, and never cached. Unlike /api/auth/me, a missing or dead session
 * is a normal answer here, not an error.
 */
export const GET = withErrors(async (req) => {
  await connection();
  const auth = await getAuth(req, getDeps().now());
  if (!auth) return jsonResponse({ user: null });
  const headers: Record<string, string> = {};
  // Sliding customer sessions re-issue the persistent cookie so its Max-Age slides too.
  if (auth.refreshed && auth.session.kind === "customer") {
    headers["Set-Cookie"] = sessionCookieHeader(auth.token, "customer");
  }
  return jsonResponse({ user: toPublicUser(auth.user) }, { headers });
});
