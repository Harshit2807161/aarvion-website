import { HttpError } from "../http.ts";
import { getDeps } from "../deps.ts";
import { readSessionToken } from "./cookie.ts";
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
