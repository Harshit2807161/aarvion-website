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
 */
import type { Channel, SignupPayload } from "./api.ts";
import { LOGIN_COPY, RESEND_SEC, mmss } from "./login-copy.ts";
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
      default:
        return s;
    }
  }

  return s;
}
