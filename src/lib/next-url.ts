const BASE = "https://aarvion.invalid";
const MAX_LENGTH = 512;
/** Paths a post-login redirect must never land on (loops, API responses, dev-only pages). */
const BLOCKED_PREFIXES = ["/login", "/api/", "/dev/"];

/**
 * Returns a safe same-origin path for the `?next=` parameter, or "/" for anything else.
 * Guards against open redirects ("//host", "/\host", absolute URLs, "javascript:"), control
 * characters (browsers strip tabs and newlines inside URLs, turning "/\t/evil" into "//evil"),
 * oversized values and pages that make no sense after sign-in.
 *
 * Parsing collapses dot segments ("/.//evil.com" becomes "//evil.com"), so the checks that
 * matter run on the resolved OUTPUT, not only on the raw input. Pass the result straight to
 * `router.replace`/`push`/`redirect`; never decode it (that would turn "/%2F%2Fevil.com" into
 * a protocol-relative URL).
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
  const out = url.pathname + url.search + url.hash;
  // The output itself must stay same-origin: no "//" or "/\\" start, no backslash.
  if (out.startsWith("//") || out.startsWith("/\\") || out.includes("\\")) return "/";
  if (new URL(out, BASE).origin !== BASE) return "/";
  // Block-list on the normalised path, case-insensitively and with percent escapes decoded.
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep the encoded path
  }
  path = path.toLowerCase();
  if (BLOCKED_PREFIXES.some((p) => path.startsWith(p))) return "/";
  return out;
}
