/**
 * The login state machine and its copy: pure logic, no React, no fetch. Tasks 41-43 (the /login
 * page and the header dialog) drive it with `useReducer(loginReducer, undefined, initialLoginState)`
 * and run the effects it asks for. The numbers below are client copies of the server's limits,
 * pinned to them by `login-machine.test.ts`; runtime code under `src/components` must not import
 * `src/server/**`.
 *
 * Effects the UI runs (the reducer never does I/O):
 * - id step, `busy`: call `sendCode`, then dispatch `sendOk` or `sendFail`.
 * - code step, `busy` and not `sessionCheck`: call `verifyCode` (with `state.signup`), then
 *   dispatch `verifyOk` or `verifyFail`.
 * - `sessionCheck` true (code or profile step): a verify ended in `network`, and the sign-in may
 *   still have worked (a timeout after the server set the cookie). Call `fetchSession()` and
 *   dispatch `sessionChecked`: a session means signed in, `null` shows the network error.
 * - While locked on a timer, dispatch `tick` about once a second and render `codeMessage`.
 */
import type { Channel, SignupPayload } from "./api.ts";
import { EMAIL_RE, MOBILE_RE, formatMobile, normMobile } from "./phone.ts";

/** Client copies of OTP_MAX_ATTEMPTS, RESEND_AFTER_SEC and OTP_TTL_MS (pinned by the test). */
export const MAX_TRIES = 5;
export const RESEND_SEC = 30;
export const CODE_TTL_MS = 300_000;

/** Shown in place of a wait when the server sent none; no "NaN" may ever reach the screen. */
const SOME_WHILE = "a little while";
/** How long Verify stays blocked after a 429 that carried no usable wait. */
const FALLBACK_LOCK_MS = 60_000;

export const LOGIN_COPY = {
  idTitle: "Sign in or create an account",
  idSub: "We’ll send you a 6-digit code. There’s no password.",
  mobile: "Mobile",
  email: "Email",
  mobileLabel: "Mobile number",
  mobileHint: "Indian mobile numbers (+91) only.",
  mobileRequired: "Enter your 10-digit mobile number.",
  mobileInvalid: "Enter a 10-digit mobile number that starts with 6, 7, 8 or 9.",
  emailLabel: "Email address",
  emailRequired: "Enter your email address.",
  emailInvalid: "Enter an email address like name@example.com.",
  send: "Send code",
  sending: "Sending code…",
  codeTitle: "Enter the code",
  codeSent: "We sent a 6-digit code to",
  change: "Change",
  codeLabel: "6-digit code",
  codeHint: "The code works for 5 minutes. You can paste it.",
  resendIn: "Resend code in",
  resend: "Send a new code",
  verify: "Verify and sign in",
  verifying: "Checking…",
  incomplete: "Enter all 6 digits of the code.",
  wrong: (n: number) => `That code doesn’t match. ${n} ${n === 1 ? "try" : "tries"} left.`,
  lockedWait: (t: string) =>
    `Too many wrong codes, so this code no longer works. You can ask for a new one in ${t}.`,
  lockedReady: "Too many wrong codes, so this code no longer works. Ask for a new one below.",
  expired: "This code has expired. Ask for a new one.",
  daily: (what: "number" | "email", wait: string) =>
    `Too many wrong codes for this ${what} today. Try again in ${wait}.`,
  rateLimited: (t: string) => `Too many codes requested. Try again in ${t}.`,
  verifyRateLimited: (t: string) => `Too many attempts from this network. Try again in ${t}.`,
  deliveryFailed: (channel: "phone" | "email") =>
    `We couldn’t send the code. Try again, or use ${channel === "phone" ? "your email" : "your mobile number"} instead.`,
  network: "Something went wrong. Check your connection and try again.",
  profileTitle: "Create your account",
  profileSub: "is verified. One more step and you’re in.",
  nameLabel: "Full name",
  nameInvalid: "Enter the full name, at least 2 letters.",
  // Added in Task 40 (Task 39 review carry a): the server refused the name we sent, which the
  // client checks cannot always predict (hidden characters, over 80 characters).
  nameRefused: "Enter your name using letters only.",
  adult: "I am 18 or older",
  adultRequired: "Confirm that you are 18 or older to create an account.",
  terms: "I agree to the Terms of use and the Privacy policy",
  termsRequired: "Agree to the Terms of use and the Privacy policy to create an account.",
  marketing: "Tell me about new Aarvion medicines",
  marketingSub: "Optional. By SMS and email. Change it any time in your account.",
  create: "Create account",
  creating: "Creating your account…",
  doneTitle: "You’re signed in",
  doneCheckout: "Taking you to checkout…",
  doneDefault: "One moment…",
  shield: "We use your number or email to sign you in and to send updates about your orders.",
  newCodeToast: (to: string) => `New code sent to ${to}`,
  signedInToast: (first: string | null) => (first ? `Signed in as ${first}` : "Signed in"),
} as const;

/** A finite, non-negative whole number of seconds (rounded up), or null for anything else. */
function wholeSec(sec: number | undefined): number | null {
  return typeof sec === "number" && Number.isFinite(sec) && sec >= 0 ? Math.ceil(sec) : null;
}

/** 30 -> "0:30", 125 -> "2:05". A missing or non-finite wait reads "a little while". */
export function mmss(sec: number | undefined): string {
  const s = wholeSec(sec);
  if (s === null) return SOME_WHILE;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Long waits in words, rounded up: 1500 -> "25 minutes", 3600 -> "1 hour", 10_800 -> "3 hours". */
export function waitText(sec: number | undefined): string {
  const s = wholeSec(sec);
  if (s === null) return SOME_WHILE;
  if (Math.ceil(s / 60) < 60) {
    const m = Math.max(1, Math.ceil(s / 60));
    return `${m} ${m === 1 ? "minute" : "minutes"}`;
  }
  const h = Math.ceil(s / 3600);
  return `${h} ${h === 1 ? "hour" : "hours"}`;
}

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

/** The identifier as the server expects it: ten digits, or a trimmed lower-case email. */
function identifierOf(channel: Channel, raw: string): string {
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

/** Mirrors the server's name rule (trimmed, 2 to 80 characters, one letter, no hidden characters). */
const NO_HIDDEN_CHARS = /^(?:\P{C}|(?<=[\p{L}\p{M}])[‌‍](?=[\p{L}\p{M}]))*$/u;
function nameOk(name: string): boolean {
  const n = name.trim();
  return n.length >= 2 && n.length <= 80 && /\p{L}/u.test(n) && NO_HIDDEN_CHARS.test(n);
}

function sendFailMessage(channel: Channel, e: Extract<LoginEvent, { type: "sendFail" }>): string {
  switch (e.error) {
    case "invalid_identifier":
      return channel === "phone" ? LOGIN_COPY.mobileInvalid : LOGIN_COPY.emailInvalid;
    case "rate_limited":
    case "resend_cooldown":
      return LOGIN_COPY.rateLimited(mmss(e.retryAfterSec));
    case "delivery_failed":
      return LOGIN_COPY.deliveryFailed(channel);
    default:
      return LOGIN_COPY.network;
  }
}

type CodeState = Extract<LoginState, { step: "code" }>;
type ProfileState = Extract<LoginState, { step: "profile" }>;

function codeFrom(s: ProfileState, patch: Partial<CodeState>): CodeState {
  return {
    step: "code",
    channel: s.channel,
    identifier: s.identifier,
    sentTo: s.sentTo,
    sentAt: s.sentAt,
    resendAt: s.resendAt,
    tries: 0,
    locked: null,
    lockedUntil: null,
    error: null,
    busy: false,
    signup: s.signup,
    sessionCheck: false,
    ...patch,
  };
}

function reduceVerifyFail(
  s: CodeState | ProfileState,
  e: Extract<LoginEvent, { type: "verifyFail" }>,
): LoginState {
  const what = s.channel === "phone" ? "number" : "email";
  const sentSignup = s.signup !== null;
  const lockMs = wholeSec(e.retryAfterSec) === null ? FALLBACK_LOCK_MS : e.retryAfterSec! * 1000;
  switch (e.error) {
    case "network":
      // The sign-in may have worked; the UI checks the session before showing an error.
      return { ...s, busy: true, error: null, sessionCheck: true };
    case "signup_required":
      if (s.step === "code" && !sentSignup) {
        return {
          step: "profile",
          channel: s.channel,
          identifier: s.identifier,
          sentTo: s.sentTo,
          sentAt: s.sentAt,
          resendAt: s.resendAt,
          code: e.code,
          error: null,
          fieldErrors: {},
          busy: false,
          signup: null,
          sessionCheck: false,
        };
      }
      // Details were already sent, so the server refused them (almost always the name).
      return {
        step: "profile",
        channel: s.channel,
        identifier: s.identifier,
        sentTo: s.sentTo,
        sentAt: s.sentAt,
        resendAt: s.resendAt,
        code: e.code,
        error: null,
        fieldErrors: { name: LOGIN_COPY.nameRefused },
        busy: false,
        signup: s.signup,
        sessionCheck: false,
      };
    case "invalid_code": {
      if (s.step === "profile") {
        return codeFrom(s, { error: LOGIN_COPY.expired });
      }
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
      if (s.step === "profile") return { ...s, busy: false, error };
      return { ...s, busy: false, locked: "network", lockedUntil: e.now + lockMs, error };
    }
  }
}

export function loginReducer(s: LoginState, e: LoginEvent): LoginState {
  if (s.step === "id") {
    switch (e.type) {
      case "channel":
        return { ...s, channel: e.channel, raw: "", error: null, busy: false };
      case "input":
        return { ...s, raw: e.raw, error: null };
      case "submitId": {
        const error = idError(s.channel, identifierOf(s.channel, s.raw));
        return error ? { ...s, error } : { ...s, error: null, busy: true };
      }
      case "sendOk": {
        const identifier = identifierOf(s.channel, s.raw);
        return {
          step: "code",
          channel: s.channel,
          identifier,
          sentTo: s.channel === "phone" ? formatMobile(identifier) : identifier,
          sentAt: e.now,
          resendAt: e.now + RESEND_SEC * 1000,
          tries: 0,
          locked: null,
          lockedUntil: null,
          error: null,
          busy: false,
          signup: null,
          sessionCheck: false,
        };
      }
      case "sendFail":
        return { ...s, busy: false, error: sendFailMessage(s.channel, e) };
      default:
        return s;
    }
  }

  if (s.step === "code") {
    switch (e.type) {
      case "change":
        return {
          step: "id",
          channel: s.channel,
          raw: s.identifier,
          error: null,
          busy: false,
        };
      case "resendStart":
        return { ...s, busy: true, error: null };
      case "sendOk":
        // A resend invalidates the held code: fresh clock, fresh try budget, no lock.
        return {
          ...s,
          sentAt: e.now,
          resendAt: e.now + RESEND_SEC * 1000,
          tries: 0,
          locked: null,
          lockedUntil: null,
          error: null,
          busy: false,
          sessionCheck: false,
        };
      case "sendFail": {
        const wait = wholeSec(e.retryAfterSec);
        return {
          ...s,
          busy: false,
          error: sendFailMessage(s.channel, e),
          resendAt:
            e.error === "resend_cooldown" && wait !== null ? e.now + wait * 1000 : s.resendAt,
        };
      }
      case "verifyStart":
        // A locked code is never sent; the UI disables Verify, this keeps the reducer honest.
        return s.locked ? s : { ...s, busy: true, error: null };
      case "verifyOk":
        return { step: "done", isNewUser: e.isNewUser };
      case "verifyFail":
        return reduceVerifyFail(s, e);
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
        return {
          step: "id",
          channel: s.channel,
          raw: s.identifier,
          error: null,
          busy: false,
        };
      case "profileSubmit": {
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
      case "verifyStart":
        return { ...s, busy: true, error: null };
      case "verifyOk":
        return { step: "done", isNewUser: e.isNewUser };
      case "verifyFail":
        return reduceVerifyFail(s, e);
      case "sessionChecked":
        if (!s.sessionCheck) return s;
        return e.session
          ? { step: "done", isNewUser: true }
          : { ...s, busy: false, sessionCheck: false, error: LOGIN_COPY.network };
      default:
        return s;
    }
  }

  return s;
}

/** The message to show under the code field at time `now`, or null. Counts down while a code is locked. */
export function codeMessage(s: LoginState, now: number): string | null {
  if (s.step !== "code") return null;
  if (s.locked === "tries") {
    return now < s.resendAt
      ? LOGIN_COPY.lockedWait(mmss((s.resendAt - now) / 1000))
      : LOGIN_COPY.lockedReady;
  }
  return s.error;
}
