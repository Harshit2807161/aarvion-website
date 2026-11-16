import type { SessionKind } from "./sessions.ts";

export const SESSION_COOKIE = "__Host-aarv_sid";

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
/**
 * Mirrors SESSION_POLICY.customer.idleMs (a test pins the two together). Kept local so
 * this module has no runtime import of sessions.ts (no cookie <-> sessions cycle).
 */
const CUSTOMER_MAX_AGE_SEC = 2_592_000;

/** The session token from the Cookie header, or null unless it is exactly 43 base64url chars. */
export function readSessionToken(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    return TOKEN_RE.test(value) ? value : null;
  }
  return null;
}

/**
 * Customers get a 30 day persistent cookie; staff get a browser-session cookie
 * (no Max-Age) because their server-side session is short and capped anyway.
 */
export function sessionCookieHeader(token: string, kind: SessionKind): string {
  const maxAge = kind === "customer" ? `Max-Age=${CUSTOMER_MAX_AGE_SEC}; ` : "";
  return `${SESSION_COOKIE}=${token}; Path=/; ${maxAge}Secure; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}
