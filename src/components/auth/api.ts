/**
 * Browser client for the login endpoints. It talks to the HTTP contracts only and never imports
 * `src/server/auth/**`. No function throws: a transport failure, a timeout, a non-JSON body or
 * any unexpected status all become a safe `ok: false` result ("network"), except a 400 on send
 * (`invalid_identifier`) and a 400 or 413 on verify with a signup (`signup_required`), where the
 * status wins whatever the body. Nothing here logs; the
 * identifier, code and name are personal data.
 */

export type Channel = "phone" | "email";

/** Pinned to the server's `SignupInput` by a type-level test. Name rules are enforced server-side. */
export type SignupPayload = {
  name: string;
  adult: true;
  termsPrivacy: true;
  marketing: boolean;
};

export type SendResult =
  | { ok: true }
  | {
      ok: false;
      error:
        "invalid_identifier" | "resend_cooldown" | "rate_limited" | "delivery_failed" | "network";
      retryAfterSec?: number;
    };

export type VerifyResult =
  | { ok: true; isNewUser: boolean; user: { name: string | null } }
  | {
      ok: false;
      error: "invalid_code" | "too_many_attempts" | "rate_limited" | "signup_required" | "network";
      retryAfterSec?: number;
    };

const REQUEST_TIMEOUT_MS = 15_000;

export type Json = Record<string, unknown>;
type Reply = { status: number; ok: boolean; body: Json | null } | null;

/** A timeout signal; browsers without `AbortSignal.timeout` get a timer-backed controller. */
function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  if (typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(ms), clear: () => {} };
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  return { signal: ctl.signal, clear: () => clearTimeout(timer) };
}

/** Sends the request and parses a JSON object body; null on transport failure. */
export async function call(path: string, init: RequestInit): Promise<Reply> {
  // A hung request must settle, or the busy state of the screen never clears.
  const { signal, clear } = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(path, { credentials: "same-origin", signal, ...init });
    let body: Json | null = null;
    try {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Json;
    } catch {
      body = null;
    }
    return { status: res.status, ok: res.ok, body };
  } catch {
    return null;
  } finally {
    clear();
  }
}

function post(path: string, payload: unknown): Promise<Reply> {
  return call(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function retryAfter(body: Json | null): { retryAfterSec?: number } {
  const v = body?.retryAfterSec;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? { retryAfterSec: v } : {};
}

const SEND_ERRORS = [
  "invalid_identifier",
  "resend_cooldown",
  "rate_limited",
  "delivery_failed",
] as const;
const VERIFY_ERRORS = [
  "invalid_code",
  "too_many_attempts",
  "rate_limited",
  "signup_required",
] as const;

export async function sendCode(channel: Channel, identifier: string): Promise<SendResult> {
  const r = await post("/api/auth/otp/send", { channel, identifier });
  if (!r) return { ok: false, error: "network" };
  // A 2xx that is not the expected JSON (a proxy page, a service worker) must not read as "sent".
  if (r.ok) return r.body?.ok === true ? { ok: true } : { ok: false, error: "network" };
  const known = SEND_ERRORS.find((e) => e === r.body?.error);
  if (!known) {
    // A 400 here (invalid_request, invalid_json) can only be the identifier: channel is typed.
    return { ok: false, error: r.status === 400 ? "invalid_identifier" : "network" };
  }
  return { ok: false, error: known, ...retryAfter(r.body) };
}

export async function verifyCode(
  channel: Channel,
  identifier: string,
  code: string,
  signup?: SignupPayload,
): Promise<VerifyResult> {
  const payload = signup
    ? { channel, identifier, code, signup: { ...signup, name: signup.name.trim() } }
    : { channel, identifier, code };
  const r = await post("/api/auth/otp/verify", payload);
  if (!r) return { ok: false, error: "network" };
  if (r.ok) {
    const user = r.body?.user;
    if (!user || typeof user !== "object" || typeof r.body?.isNewUser !== "boolean") {
      return { ok: false, error: "network" };
    }
    const name = (user as Json).name;
    return {
      ok: true,
      isNewUser: r.body.isNewUser,
      user: { name: typeof name === "string" ? name : null },
    };
  }
  const known = VERIFY_ERRORS.find((e) => e === r.body?.error);
  if (!known) {
    // adult, termsPrivacy and marketing are fixed by type, so when the server refuses the signup
    // body (400 invalid_request, or 413) the name is what it refused. Never fall back to
    // invalid_code: that would spend a try on a code the server never checked.
    const refusedName = signup !== undefined && (r.status === 400 || r.status === 413);
    return { ok: false, error: refusedName ? "signup_required" : "network" };
  }
  return { ok: false, error: known, ...retryAfter(r.body) };
}

/** The signed-in customer's name (null if unnamed), or null when signed out or on any failure. */
export async function fetchSession(): Promise<{ name: string | null } | null> {
  const r = await call("/api/auth/session", { method: "GET", cache: "no-store" });
  if (!r || !r.ok) return null;
  const user = r.body?.user;
  if (!user || typeof user !== "object") return null;
  const name = (user as Json).name;
  return { name: typeof name === "string" ? name : null };
}
