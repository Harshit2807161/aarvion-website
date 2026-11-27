import { call, type Json } from "./api";

/**
 * Whether anyone is signed in, telling "nobody" apart from "could not find out": `out` only on a
 * 200 that says no user, `unknown` on a timeout, a 5xx or a body that is not the session shape.
 * Callers that would change state for "nobody" (the cart store dropping to a guest cart) must
 * not do it on `unknown`.
 */
export async function fetchSessionState(): Promise<
  { state: "in"; name: string | null } | { state: "out" } | { state: "unknown" }
> {
  const r = await call("/api/auth/session", { method: "GET", cache: "no-store" });
  if (!r || !r.ok || !r.body || !("user" in r.body)) return { state: "unknown" };
  const user = r.body.user;
  if (user === null) return { state: "out" };
  if (typeof user !== "object") return { state: "unknown" };
  const name = (user as Json).name;
  return { state: "in", name: typeof name === "string" ? name : null };
}
