import { connection } from "next/server";
import { getAuth, sessionRefreshHeaders } from "@/server/auth/guards";
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
  return jsonResponse({ user: toPublicUser(auth.user) }, { headers: sessionRefreshHeaders(auth) });
});
