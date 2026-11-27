import { HttpError } from "../http.ts";
import { getDeps } from "../deps.ts";
import { readSessionToken, sessionCookieHeader } from "./cookie.ts";
import type { StaffRole } from "./roles.ts";
import { resolveSession, type SessionDoc } from "./sessions.ts";
import { getUserById, type UserDoc } from "./users.ts";

export type AuthContext = { user: UserDoc; session: SessionDoc; token: string; refreshed: boolean };

/**
 * The authenticated user for this request, or null. A session whose user no longer
 * exists is unauthenticated. The user is always loaded fresh from the database.
 */
export async function getAuth(req: Request, now: Date): Promise<AuthContext | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const resolved = await resolveSession(token, now);
  if (!resolved) return null;
  const user = await getUserById(resolved.session.userId);
  if (!user) return null;
  return { user, session: resolved.session, token, refreshed: resolved.refreshed };
}

export async function requireUser(req: Request): Promise<AuthContext> {
  const auth = await getAuth(req, getDeps().now());
  if (!auth) throw new HttpError(401, "unauthenticated");
  return auth;
}

/**
 * Staff access needs BOTH a current staff role in the database and a staff-kind
 * session. A customer session of a user promoted since is refused until re-login.
 */
export async function requireRole(req: Request, roles: readonly StaffRole[]): Promise<AuthContext> {
  const auth = await requireUser(req);
  if (auth.session.kind !== "staff" || !(roles as readonly string[]).includes(auth.user.role)) {
    throw new HttpError(403, "forbidden");
  }
  return auth;
}

/**
 * Response headers that re-issue the sliding customer cookie. `resolveSession` slides the
 * server-side window on use, but the browser cookie only gets a fresh 30 days when the route
 * sends it again; every customer route that calls `requireUser` merges these into its response.
 * Staff sessions use a browser-session cookie, so they get nothing.
 */
export function sessionRefreshHeaders(auth: AuthContext): Headers {
  const headers = new Headers();
  if (auth.refreshed && auth.session.kind === "customer") {
    headers.append("Set-Cookie", sessionCookieHeader(auth.token, "customer"));
  }
  return headers;
}
