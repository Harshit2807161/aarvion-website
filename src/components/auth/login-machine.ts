/**
 * The login state machine: pure logic, no React, no fetch. Tasks 41-43 (the /login page and the
 * header dialog) drive it with `useReducer(loginReducer, undefined, initialLoginState)` and run
 * the effects below. The copy and the client copies of the server's limits live in
 * `login-copy.ts` (re-exported here and pinned to the server by `login-copy.test.ts`); runtime
 * code under `src/components` must not import `src/server/**`.
 *
 * `busy` is a real guard: while a state is busy the reducer ignores every event except a result
 * and `tick`, and it ignores a result when the state is not busy, so a double submit, an edit
 * mid-request or a late response changes nothing. Post exactly `identifierOf(channel, raw)`, the
 * string the machine validated. Pass the time the request STARTED as `now` in `sendOk`, so the
 * code clock does not lag the server's by the delivery time. Waits and expiry follow the wall
 * clock and are not clamped: if the clock moves back, a countdown reads longer than the real
 * wait until the clock catches up (the server still enforces the real limit).
 *
 * Effects the UI runs (the reducer never does I/O):
 * - id step, `busy`: call `sendCode(channel, identifierOf(channel, raw))`, then dispatch `sendOk`
 *   or `sendFail`.
 * - code step, `busy`, not `sessionCheck`: after `verifyStart` call `verifyCode` (with
 *   `state.signup`), after `resendStart` call `sendCode(channel, identifier)`; dispatch
 *   `verifyOk`/`verifyFail` or `sendOk`/`sendFail` accordingly.
 * - While a code is locked on a timer, dispatch `tick` about once a second and render
 *   `codeMessage(state, now)`.
 */
import type { Channel, SignupPayload } from "./api.ts";
import {
  CODE_TTL_MS,
  FALLBACK_LOCK_MS,
  LOGIN_COPY,
  MAX_TRIES,
  RESEND_SEC,
  mmss,
  waitText,
  wholeSec,
} from "./login-copy.ts";
import { EMAIL_RE, MOBILE_RE, formatMobile, normMobile } from "./phone.ts";

export * from "./login-copy.ts";

export type SignupValues = {
  name: string;
  adult: boolean;
  termsPrivacy: boolean;
  marketing?: boolean;
};
type FieldErrors = Partial<Record<"name" | "adult" | "termsPrivacy", string>>;
type CodeLock = null | "tries" | "daily" | "network";

export type LoginState =
  | { step: "id"; channel: Channel; raw: string; error: string | null; busy: boolean }
  | {
      step: "code";
      channel: Channel;
      identifier: string;
      sentTo: string;
      sentAt: number;
      resendAt: number;
      tries: number;
      locked: CodeLock;
      lockedUntil: number | null;
      error: string | null;
      busy: boolean;
      signup: SignupPayload | null;
      /** True while the UI must run `fetchSession()` and dispatch `sessionChecked`. */
      sessionCheck: boolean;
    }
  | {
      step: "profile";
      channel: Channel;
      identifier: string;
      sentTo: string;
      sentAt: number;
      resendAt: number;
      code: string;
      error: string | null;
      fieldErrors: FieldErrors;
      busy: boolean;
      /** When a rate limit lets Create account work again; null when it is not limited. */
      lockedUntil: number | null;
      /** The details being sent (or refused), so the form can be refilled and a return to the code step keeps them. */
      signup: SignupPayload | null;
      sessionCheck: boolean;
    }
  | { step: "done"; isNewUser: boolean };

export type LoginEvent =
  | { type: "channel"; channel: Channel }
  | { type: "input"; raw: string }
  | { type: "submitId" }
  | { type: "sendOk"; now: number }
  | {
      type: "sendFail";
      error:
        "invalid_identifier" | "resend_cooldown" | "rate_limited" | "delivery_failed" | "network";
      retryAfterSec?: number;
      now: number;
    }
  | { type: "verifyStart" }
  | { type: "verifyOk"; isNewUser: boolean }
  | {
      type: "verifyFail";
      error: "invalid_code" | "too_many_attempts" | "rate_limited" | "signup_required" | "network";
      retryAfterSec?: number;
      now: number;
      code: string;
    }
  | { type: "sessionChecked"; session: { name: string | null } | null }
  | { type: "profileSubmit"; values: SignupValues }
  | { type: "tick"; now: number }
  | { type: "change" }
  | { type: "resendStart" };

export function initialLoginState(): LoginState {
  return { step: "id", channel: "phone", raw: "", error: null, busy: false };
}

/** The identifier as the server expects it: ten digits, or a trimmed lower-case email. Post exactly this. */
export function identifierOf(channel: Channel, raw: string): string {
  return channel === "phone" ? normMobile(raw) : raw.trim().toLowerCase();
}

function idError(channel: Channel, identifier: string): string | null {
  if (channel === "phone") {
    if (identifier === "") return LOGIN_COPY.mobileRequired;
    return MOBILE_RE.test(identifier) ? null : LOGIN_COPY.mobileInvalid;
  }
  if (identifier === "") return LOGIN_COPY.emailRequired;
  return EMAIL_RE.test(identifier) ? null : LOGIN_COPY.emailInvalid;
}

function sendFailMessage(channel: Channel, e: Extract<LoginEvent, { type: "sendFail" }>): string {
  switch (e.error) {
    case "invalid_identifier":
      return channel === "phone" ? LOGIN_COPY.mobileInvalid : LOGIN_COPY.emailInvalid;
    case "rate_limited":
      return LOGIN_COPY.rateLimited(mmss(e.retryAfterSec));
    case "delivery_failed":
      return LOGIN_COPY.deliveryFailed(channel);
    case "resend_cooldown":
      return ""; // never shown: the code step's resend countdown says it
    default:
      return LOGIN_COPY.network;
  }
}

type CodeState = Extract<LoginState, { step: "code" }>;

/** A fresh code step for a code that was sent at `sentAt`. */
function newCodeState(
  channel: Channel,
  identifier: string,
  sentAt: number,
  resendAt: number,
): CodeState {
  return {
    step: "code",
    channel,
    identifier,
    sentTo: channel === "phone" ? formatMobile(identifier) : identifier,
    sentAt,
    resendAt,
    tries: 0,
    locked: null,
    lockedUntil: null,
    error: null,
    busy: false,
    signup: null,
    sessionCheck: false,
  };
}

/** The id step with the identifier filled in, as after Change or a resend that could not deliver. */
function idFrom(
  s: CodeState | { channel: Channel; identifier: string },
  error: string | null,
): LoginState {
  return { step: "id", channel: s.channel, raw: s.identifier, error, busy: false };
}

/** A verify failure in the code step. Sign-up and network outcomes arrive in the last PR. */
function reduceVerifyFail(
  s: CodeState,
  e: Extract<LoginEvent, { type: "verifyFail" }>,
): LoginState {
  const what = s.channel === "phone" ? "number" : "email";
  const lockMs = wholeSec(e.retryAfterSec) === null ? FALLBACK_LOCK_MS : e.retryAfterSec! * 1000;
  switch (e.error) {
    case "invalid_code": {
      if (e.now - s.sentAt >= CODE_TTL_MS) return { ...s, busy: false, error: LOGIN_COPY.expired };
      const tries = s.tries + 1;
      if (tries >= MAX_TRIES) {
        return { ...s, busy: false, tries, locked: "tries", lockedUntil: null, error: null };
      }
      return { ...s, busy: false, tries, error: LOGIN_COPY.wrong(MAX_TRIES - tries) };
    }
    case "too_many_attempts": {
      const error = LOGIN_COPY.daily(what, waitText(e.retryAfterSec));
      return { ...s, busy: false, locked: "daily", lockedUntil: e.now + lockMs, error };
    }
    case "rate_limited": {
      const error = LOGIN_COPY.verifyRateLimited(mmss(e.retryAfterSec));
      return { ...s, busy: false, locked: "network", lockedUntil: e.now + lockMs, error };
    }
    default:
      return { ...s, busy: false, error: LOGIN_COPY.network };
  }
}

export function loginReducer(s: LoginState, e: LoginEvent): LoginState {
  if (s.step === "id") {
    switch (e.type) {
      case "channel":
        return s.busy ? s : { ...s, channel: e.channel, raw: "", error: null };
      case "input":
        return s.busy ? s : { ...s, raw: e.raw, error: null };
      case "submitId": {
        if (s.busy) return s;
        const error = idError(s.channel, identifierOf(s.channel, s.raw));
        return error ? { ...s, error } : { ...s, error: null, busy: true };
      }
      case "sendOk": {
        if (!s.busy) return s;
        const sentAt = e.now;
        return newCodeState(
          s.channel,
          identifierOf(s.channel, s.raw),
          sentAt,
          sentAt + RESEND_SEC * 1000,
        );
      }
      case "sendFail": {
        if (!s.busy) return s;
        if (e.error === "resend_cooldown") {
          // The server sent this identifier a code under 30 s ago and it is still live: go to the
          // code step and let its resend countdown say so.
          const wait = wholeSec(e.retryAfterSec) ?? RESEND_SEC;
          const resendAt = e.now + wait * 1000;
          return newCodeState(
            s.channel,
            identifierOf(s.channel, s.raw),
            resendAt - RESEND_SEC * 1000,
            resendAt,
          );
        }
        return { ...s, busy: false, error: sendFailMessage(s.channel, e) };
      }
      default:
        return s;
    }
  }

  if (s.step === "code") {
    switch (e.type) {
      case "change":
        return s.busy ? s : idFrom(s, null);
      case "resendStart":
        // Under a daily or network lock a new code could never be verified, and sending one
        // would cost an SMS and the send budget. The lock message stays until `tick` lifts it.
        return s.busy || s.locked === "daily" || s.locked === "network"
          ? s
          : { ...s, busy: true, error: null };
      case "sendOk":
        if (!s.busy || s.sessionCheck) return s;
        // A new code starts a fresh clock and try budget and lifts only the per-code lock. The
        // daily and network locks belong to the identifier and the IP, which the server keeps.
        return {
          ...s,
          sentAt: e.now,
          resendAt: e.now + RESEND_SEC * 1000,
          tries: 0,
          locked: s.locked === "tries" ? null : s.locked,
          lockedUntil: s.locked === "tries" ? null : s.lockedUntil,
          error: null,
          busy: false,
        };
      case "sendFail": {
        if (!s.busy || s.sessionCheck) return s;
        // The failed delivery deleted the held code on the server: nothing left to verify.
        if (e.error === "delivery_failed") return idFrom(s, sendFailMessage(s.channel, e));
        const waits = e.error === "rate_limited" || e.error === "resend_cooldown";
        const wait = wholeSec(e.retryAfterSec) ?? RESEND_SEC;
        // A wait is shown as a countdown (the resend button, or `lockedWait` under a tries lock),
        // never as fixed text that would go stale. Other failures keep their message.
        return {
          ...s,
          busy: false,
          error: waits ? null : sendFailMessage(s.channel, e),
          resendAt: waits ? e.now + wait * 1000 : s.resendAt,
        };
      }
      case "verifyStart":
        // A locked code is never sent; the UI disables Verify, this keeps the reducer honest.
        return s.locked || s.busy ? s : { ...s, busy: true, error: null };
      case "verifyOk":
        return !s.busy || s.sessionCheck ? s : { step: "done", isNewUser: e.isNewUser };
      case "verifyFail":
        return !s.busy || s.sessionCheck ? s : reduceVerifyFail(s, e);
      case "tick":
        if ((s.locked === "daily" || s.locked === "network") && s.lockedUntil !== null) {
          if (e.now >= s.lockedUntil) {
            return { ...s, locked: null, lockedUntil: null, error: null };
          }
        }
        return s;
      default:
        return s;
    }
  }

  return s;
}

/**
 * The message under the code field at time `now`, or null. A resend failure (`error`) always
 * shows, even while the code is locked; otherwise a code locked for wrong tries counts down to
 * the moment a new one can be asked for.
 */
export function codeMessage(s: LoginState, now: number): string | null {
  if (s.step !== "code") return null;
  if (s.error !== null) return s.error;
  if (s.locked === "tries") {
    return now < s.resendAt
      ? LOGIN_COPY.lockedWait(mmss((s.resendAt - now) / 1000))
      : LOGIN_COPY.lockedReady;
  }
  return null;
}
