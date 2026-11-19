/**
 * Browser client for the login endpoints. It talks to the HTTP contracts only and never imports
 * `src/server/auth/**`. No function throws: a transport failure, a timeout, a non-JSON body or
 * any unexpected status all become a safe `ok: false` result ("network"), except a 400 on send
 * (`invalid_identifier`), where the status wins whatever the body. Nothing here logs; the
 * identifier, code and name are personal data.
 */

export type Channel = "phone" | "email";

export type SendResult =
  | { ok: true }
  | {
      ok: false;
      error:
        "invalid_identifier" | "resend_cooldown" | "rate_limited" | "delivery_failed" | "network";
      retryAfterSec?: number;
    };

const REQUEST_TIMEOUT_MS = 15_000;

type Json = Record<string, unknown>;
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
async function call(path: string, init: RequestInit): Promise<Reply> {
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
