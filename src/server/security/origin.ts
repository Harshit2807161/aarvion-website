import { getEnv } from "../env.ts";
import { HttpError } from "../http.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for state-changing requests: Origin must be present and equal the
 * request's own origin or the origin of APP_URL. A missing or "null" Origin is rejected.
 */
export function assertSameOrigin(req: Request): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return;
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") throw new HttpError(403, "bad_origin");
  const allowed = new Set([new URL(req.url).origin]);
  const appUrl = getEnv().APP_URL;
  if (appUrl) allowed.add(new URL(appUrl).origin);
  if (!allowed.has(origin)) throw new HttpError(403, "bad_origin");
}
