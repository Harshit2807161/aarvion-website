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
 * code clock does not lag the server's by the delivery time.
 *
 * Effects the UI runs (the reducer never does I/O):
 * - id step, `busy`: call `sendCode(channel, identifierOf(channel, raw))`, then dispatch `sendOk`
 *   or `sendFail`.
 * - code step, `busy`, not `sessionCheck`: after `verifyStart` call `verifyCode` (with
 *   `state.signup`), after `resendStart` call `sendCode(channel, identifier)`; dispatch
 *   `verifyOk`/`verifyFail` or `sendOk`/`sendFail` accordingly.
 * - While a code is locked on a timer, dispatch `tick` about once a second and render
 *   `codeMessage(state, now)`.
 * - profile step, `busy`, not `sessionCheck`: after `profileSubmit` call `verifyCode` with
 *   `state.code` and `state.signup`, then dispatch `verifyOk` or `verifyFail`.
 * - `sessionCheck` true (code or profile step): a verify ended in `network`, and the sign-in may
 *   still have worked (a timeout after the server set the cookie). Call `fetchSession()` and
 *   dispatch `sessionChecked`: a session means signed in, `null` shows the network error.
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

/**
 * The server's name rule (`NO_HIDDEN_CHARS` in `src/server/auth/login.ts`): no control, format or
 * default-ignorable character, except a zero-width (non-)joiner between a letter or mark and a
 * letter or mark. Kept in step by hand; the server stays the authority (`nameRefused`).
 */
const NO_HIDDEN_CHARS =
  /^(?:[^\p{C}\p{Default_Ignorable_Code_Point}]|(?<=[\p{L}\p{M}])[‌‍](?=[\p{L}\p{M}]))*$/u;
function nameOk(name: string): boolean {
  const n = name.trim();
  return n.length >= 2 && n.length <= 80 && /\p{L}/u.test(n) && NO_HIDDEN_CHARS.test(n);
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
type ProfileState = Extract<LoginState, { step: "profile" }>;

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

function codeFrom(s: ProfileState, patch: Partial<CodeState>): CodeState {
  return {
    ...newCodeState(s.channel, s.identifier, s.sentAt, s.resendAt),
    signup: s.signup,
    ...patch,
  };
}

function reduceVerifyFail(
  s: CodeState | ProfileState,
  e: Extract<LoginEvent, { type: "verifyFail" }>,
): LoginState {
  const what = s.channel === "phone" ? "number" : "email";
  const lockMs = wholeSec(e.retryAfterSec) === null ? FALLBACK_LOCK_MS : e.retryAfterSec! * 1000;
  switch (e.error) {
    case "network":
      // The sign-in may have worked; the UI checks the session before showing an error.
      return { ...s, busy: true, error: null, sessionCheck: true };
    case "signup_required":
      return {
        step: "profile",
        channel: s.channel,
        identifier: s.identifier,
        sentTo: s.sentTo,
        sentAt: s.sentAt,
        resendAt: s.resendAt,
        code: e.code,
        error: null,
        // Details already sent means the server refused them (almost always the name).
        fieldErrors: s.signup ? { name: LOGIN_COPY.nameRefused } : {},
        busy: false,
        lockedUntil: null,
        signup: s.signup,
        sessionCheck: false,
      };
    case "invalid_code": {
      if (s.step === "profile") return codeFrom(s, { error: LOGIN_COPY.expired });
      if (e.now - s.sentAt >= CODE_TTL_MS) return { ...s, busy: false, error: LOGIN_COPY.expired };
      const tries = s.tries + 1;
      if (tries >= MAX_TRIES) {
        return { ...s, busy: false, tries, locked: "tries", lockedUntil: null, error: null };
      }
      return { ...s, busy: false, tries, error: LOGIN_COPY.wrong(MAX_TRIES - tries) };
    }
    case "too_many_attempts": {
      const error = LOGIN_COPY.daily(what, waitText(e.retryAfterSec));
      if (s.step === "profile") {
        return codeFrom(s, { locked: "daily", lockedUntil: e.now + lockMs, error });
      }
      return { ...s, busy: false, locked: "daily", lockedUntil: e.now + lockMs, error };
    }
    case "rate_limited": {
      const error = LOGIN_COPY.verifyRateLimited(mmss(e.retryAfterSec));
      if (s.step === "profile") return { ...s, busy: false, lockedUntil: e.now + lockMs, error };
      return { ...s, busy: false, locked: "network", lockedUntil: e.now + lockMs, error };
    }
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
        return s.busy ? s : { ...s, busy: true, error: null };
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
        return {
          ...s,
          busy: false,
          error: e.error === "resend_cooldown" ? null : sendFailMessage(s.channel, e),
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
      case "sessionChecked":
        if (!s.sessionCheck) return s;
        return e.session
          ? { step: "done", isNewUser: s.signup !== null }
          : { ...s, busy: false, sessionCheck: false, error: LOGIN_COPY.network };
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

  if (s.step === "profile") {
    switch (e.type) {
      case "change":
        return s.busy ? s : idFrom(s, null);
      case "profileSubmit": {
        if (s.busy || s.lockedUntil !== null) return s;
        const v = e.values;
        const fieldErrors: FieldErrors = {};
        if (!nameOk(v.name)) fieldErrors.name = LOGIN_COPY.nameInvalid;
        if (!v.adult) fieldErrors.adult = LOGIN_COPY.adultRequired;
        if (!v.termsPrivacy) fieldErrors.termsPrivacy = LOGIN_COPY.termsRequired;
        if (Object.keys(fieldErrors).length > 0) return { ...s, fieldErrors, error: null };
        return {
          ...s,
          fieldErrors: {},
          error: null,
          busy: true,
          signup: {
            name: v.name.trim(),
            adult: true,
            termsPrivacy: true,
            marketing: v.marketing === true,
          },
        };
      }
      case "verifyOk":
        return !s.busy || s.sessionCheck ? s : { step: "done", isNewUser: e.isNewUser };
      case "verifyFail":
        return !s.busy || s.sessionCheck ? s : reduceVerifyFail(s, e);
      case "sessionChecked":
        if (!s.sessionCheck) return s;
        return e.session
          ? { step: "done", isNewUser: true }
          : { ...s, busy: false, sessionCheck: false, error: LOGIN_COPY.network };
      case "tick":
        return s.lockedUntil !== null && e.now >= s.lockedUntil
          ? { ...s, lockedUntil: null, error: null }
          : s;
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
