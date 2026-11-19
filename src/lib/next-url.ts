const BASE = "https://aarvion.invalid";
const MAX_LENGTH = 512;
/** Paths a post-login redirect must never land on (loops, API responses, dev-only pages). */
const BLOCKED_PREFIXES = ["/login", "/api/", "/dev/"];

/**
 * Returns a safe same-origin path for the `?next=` parameter, or "/" for anything else.
 * Guards against open redirects ("//host", "/\host", absolute URLs, "javascript:"), control
 * characters (browsers strip tabs and newlines inside URLs, turning "/\t/evil" into "//evil"),
 * oversized values and pages that make no sense after sign-in.
 */
export function sanitizeNext(raw: string | null): string {
  if (raw === null || raw === "") return "/";
  if (raw.length > MAX_LENGTH) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (raw.includes("\\")) return "/";
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) < 0x20) return "/";
  }
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE) return "/";
  if (BLOCKED_PREFIXES.some((p) => url.pathname.startsWith(p))) return "/";
  return url.pathname + url.search + url.hash;
}
