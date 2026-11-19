import { describe, expect, it } from "vitest";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "@/server/auth/otp";
import { RESEND_AFTER_SEC } from "@/server/auth/login";
import {
  CODE_TTL_MS,
  LOGIN_COPY,
  MAX_TRIES,
  RESEND_SEC,
  codeMessage,
  initialLoginState,
  loginReducer,
  mmss,
  waitText,
  type LoginEvent,
  type LoginState,
} from "./login-machine.ts";

const T = 1_000_000;

function run(events: LoginEvent[], from: LoginState = initialLoginState()): LoginState {
  return events.reduce(loginReducer, from);
}
function codeStep(channel: "phone" | "email" = "phone"): LoginState {
  const raw = channel === "phone" ? "98765 43210" : "Asha@Example.com ";
  return run([
    { type: "channel", channel },
    { type: "input", raw },
    { type: "submitId" },
    { type: "sendOk", now: T },
  ]);
}
type FailError = Extract<LoginEvent, { type: "verifyFail" }>["error"];
const fail = (
  error: FailError,
  now: number,
  extra: { retryAfterSec?: number } = {},
): LoginEvent => ({
  type: "verifyFail",
  error,
  now,
  code: "482913",
  ...extra,
});

describe("constants", () => {
  it("match the server", () => {
    expect(MAX_TRIES).toBe(OTP_MAX_ATTEMPTS);
    expect(CODE_TTL_MS).toBe(OTP_TTL_MS);
    expect(RESEND_SEC).toBe(RESEND_AFTER_SEC);
  });
});

describe("formatters", () => {
  it("mmss and waitText", () => {
    expect(mmss(30)).toBe("0:30");
    expect(mmss(125)).toBe("2:05");
    expect(waitText(1500)).toBe("25 minutes");
    expect(waitText(3600)).toBe("1 hour");
    expect(waitText(10_800)).toBe("3 hours");
    expect(waitText(3601)).toBe("2 hours");
    expect(waitText(1)).toBe("1 minute");
  });
  it("never print NaN (carry b)", () => {
    for (const bad of [undefined, NaN, Infinity, -5]) {
      expect(mmss(bad)).toBe("a little while");
      expect(waitText(bad)).toBe("a little while");
    }
  });
});

describe("id step", () => {
  it("validates the mobile number", () => {
    expect(run([{ type: "submitId" }])).toMatchObject({
      step: "id",
      error: LOGIN_COPY.mobileRequired,
      busy: false,
    });
    expect(run([{ type: "input", raw: "5876543210" }, { type: "submitId" }])).toMatchObject({
      error: LOGIN_COPY.mobileInvalid,
    });
  });
  it("validates the email, and switching channel clears the input", () => {
    const s = run([
      { type: "channel", channel: "email" },
      { type: "input", raw: "x@y" },
      { type: "submitId" },
    ]);
    expect(s).toMatchObject({ error: LOGIN_COPY.emailInvalid });
    expect(run([{ type: "channel", channel: "email" }, { type: "submitId" }])).toMatchObject({
      error: LOGIN_COPY.emailRequired,
    });
    expect(loginReducer(s, { type: "channel", channel: "phone" })).toMatchObject({
      raw: "",
      error: null,
    });
  });
  it("a valid number goes busy", () => {
    expect(run([{ type: "input", raw: "+91 98765 43210" }, { type: "submitId" }])).toMatchObject({
      busy: true,
      error: null,
    });
  });
});

describe("sending", () => {
  it("sendOk moves to the code step", () => {
    expect(codeStep()).toMatchObject({
      step: "code",
      identifier: "9876543210",
      sentTo: "+91 98765 43210",
      sentAt: T,
      resendAt: T + 30_000,
      tries: 0,
      locked: null,
      signup: null,
    });
    expect(codeStep("email")).toMatchObject({
      identifier: "asha@example.com",
      sentTo: "asha@example.com",
    });
  });
  const sending = () => run([{ type: "input", raw: "9876543210" }, { type: "submitId" }]);
  it("maps send failures to copy", () => {
    expect(
      loginReducer(sending(), {
        type: "sendFail",
        error: "rate_limited",
        retryAfterSec: 125,
        now: T,
      }),
    ).toMatchObject({ error: "Too many codes requested. Try again in 2:05.", busy: false });
    expect(
      loginReducer(sending(), { type: "sendFail", error: "delivery_failed", now: T }),
    ).toMatchObject({
      error: "We couldn’t send the code. Try again, or use your email instead.",
    });
    expect(
      loginReducer(sending(), { type: "sendFail", error: "invalid_identifier", now: T }),
    ).toMatchObject({ error: LOGIN_COPY.mobileInvalid });
    expect(loginReducer(sending(), { type: "sendFail", error: "network", now: T })).toMatchObject({
      error: LOGIN_COPY.network,
    });
  });
  it("a missing retryAfterSec never prints NaN (carry b)", () => {
    const s = loginReducer(sending(), { type: "sendFail", error: "rate_limited", now: T });
    expect(s).toMatchObject({ error: "Too many codes requested. Try again in a little while." });
  });
  it("a resend resets the code clock, tries and lock, and keeps the sign-up details", () => {
    const signup = { name: "Asha Rao", adult: true, termsPrivacy: true, marketing: false } as const;
    const base = codeStep();
    if (base.step !== "code") throw new Error("expected the code step");
    const locked: LoginState = { ...base, tries: 5, locked: "tries", signup };
    const s = run([{ type: "resendStart" }, { type: "sendOk", now: T + 40_000 }], locked);
    expect(s).toMatchObject({
      sentAt: T + 40_000,
      resendAt: T + 70_000,
      tries: 0,
      locked: null,
      busy: false,
      signup,
    });
  });
  it("a failed resend keeps the step and shows the message", () => {
    const s = run(
      [
        { type: "resendStart" },
        { type: "sendFail", error: "resend_cooldown", retryAfterSec: 12, now: T + 1000 },
      ],
      codeStep(),
    );
    expect(s).toMatchObject({ step: "code", busy: false, resendAt: T + 13_000 });
  });
  it("Change returns to the id step with the identifier", () => {
    expect(loginReducer(codeStep(), { type: "change" })).toMatchObject({
      step: "id",
      raw: "9876543210",
      error: null,
    });
  });
});

describe("wrong codes", () => {
  it("counts down and locks on the last try", () => {
    let s = codeStep();
    s = loginReducer(s, fail("invalid_code", T + 10_000));
    expect(s).toMatchObject({ tries: 1, error: "That code doesn’t match. 4 tries left." });
    s = run([fail("invalid_code", T + 10_000), fail("invalid_code", T + 10_000)], s);
    s = loginReducer(s, fail("invalid_code", T + 10_000));
    expect(s).toMatchObject({ tries: 4, error: "That code doesn’t match. 1 try left." });
    s = loginReducer(s, fail("invalid_code", T + 10_000));
    expect(s).toMatchObject({ tries: 5, locked: "tries" });
    expect(codeMessage(s, T + 20_000)).toBe(LOGIN_COPY.lockedWait("0:10"));
    expect(codeMessage(s, T + 30_000)).toBe(LOGIN_COPY.lockedReady);
  });
  it("an expired code says so and does not count a try", () => {
    const s = loginReducer(codeStep(), fail("invalid_code", T + 300_000));
    expect(s).toMatchObject({ tries: 0, error: LOGIN_COPY.expired, locked: null, busy: false });
  });
  it("a locked code ignores verifyStart", () => {
    const s = run(
      Array.from({ length: 5 }, () => fail("invalid_code", T + 1000)),
      codeStep(),
    );
    expect(loginReducer(s, { type: "verifyStart" })).toBe(s);
  });
});

describe("server limits", () => {
  it("too_many_attempts locks for the day", () => {
    const s = loginReducer(codeStep(), fail("too_many_attempts", T, { retryAfterSec: 3600 }));
    expect(s).toMatchObject({
      locked: "daily",
      lockedUntil: T + 3_600_000,
      error: "Too many wrong codes for this number today. Try again in 1 hour.",
    });
    const e = loginReducer(
      codeStep("email"),
      fail("too_many_attempts", T, { retryAfterSec: 1500 }),
    );
    expect(e).toMatchObject({
      error: "Too many wrong codes for this email today. Try again in 25 minutes.",
    });
  });
  it("rate_limited (C3) blocks Verify without spending a try", () => {
    const s = loginReducer(codeStep(), fail("rate_limited", T, { retryAfterSec: 900 }));
    expect(s).toMatchObject({
      tries: 0,
      locked: "network",
      lockedUntil: T + 900_000,
      error: "Too many attempts from this network. Try again in 15:00.",
    });
    expect(loginReducer(s, { type: "tick", now: T + 899_000 })).toMatchObject({
      locked: "network",
    });
    expect(loginReducer(s, { type: "tick", now: T + 900_000 })).toMatchObject({
      locked: null,
      lockedUntil: null,
      error: null,
    });
  });
  it("a missing or non-finite wait never prints NaN and still unlocks (carry b)", () => {
    const s = loginReducer(codeStep(), fail("rate_limited", T));
    expect(s).toMatchObject({
      error: "Too many attempts from this network. Try again in a little while.",
      lockedUntil: T + 60_000,
    });
    const d = loginReducer(codeStep(), fail("too_many_attempts", T, { retryAfterSec: NaN }));
    expect(d).toMatchObject({
      error: "Too many wrong codes for this number today. Try again in a little while.",
      lockedUntil: T + 60_000,
    });
    expect(JSON.stringify(d)).not.toContain("NaN");
  });
});

describe("sign-up", () => {
  const profile = () => loginReducer(codeStep(), fail("signup_required", T + 5000));
  const values = { name: "  Asha Rao ", adult: true, termsPrivacy: true } as const;

  it("signup_required opens the profile step holding the code", () => {
    expect(profile()).toMatchObject({ step: "profile", code: "482913", busy: false, signup: null });
  });
  it("validates the profile fields", () => {
    const s = loginReducer(profile(), {
      type: "profileSubmit",
      values: { name: "A", adult: false, termsPrivacy: false },
    });
    expect(s).toMatchObject({
      busy: false,
      fieldErrors: {
        name: LOGIN_COPY.nameInvalid,
        adult: LOGIN_COPY.adultRequired,
        termsPrivacy: LOGIN_COPY.termsRequired,
      },
    });
    const digits = loginReducer(profile(), {
      type: "profileSubmit",
      values: { ...values, name: "12" },
    });
    expect(digits).toMatchObject({ fieldErrors: { name: LOGIN_COPY.nameInvalid } });
  });
  it("a valid submit trims the name and goes busy", () => {
    expect(loginReducer(profile(), { type: "profileSubmit", values })).toMatchObject({
      busy: true,
      fieldErrors: {},
      signup: { name: "Asha Rao", adult: true, termsPrivacy: true, marketing: false },
    });
  });
  it("carry a: signup_required after details were sent is a name error, not a sign-up loop", () => {
    const sent = loginReducer(profile(), { type: "profileSubmit", values });
    const s = loginReducer(sent, fail("signup_required", T + 9000));
    expect(s).toMatchObject({
      step: "profile",
      busy: false,
      error: null,
      fieldErrors: { name: LOGIN_COPY.nameRefused },
      signup: { name: "Asha Rao" },
    });
  });
  it("carry a: the same from the code step after an expiry round trip", () => {
    const sent = loginReducer(profile(), { type: "profileSubmit", values });
    const back = loginReducer(sent, fail("invalid_code", T + CODE_TTL_MS + 1));
    expect(back).toMatchObject({
      step: "code",
      error: LOGIN_COPY.expired,
      signup: { name: "Asha Rao" },
    });
    const s = loginReducer(back, fail("signup_required", T + CODE_TTL_MS + 5000));
    expect(s).toMatchObject({ step: "profile", fieldErrors: { name: LOGIN_COPY.nameRefused } });
  });
  it("after the TTL, invalid_code in the profile returns to the code step keeping signup", () => {
    const sent = loginReducer(profile(), { type: "profileSubmit", values });
    expect(loginReducer(sent, fail("invalid_code", T + CODE_TTL_MS))).toMatchObject({
      step: "code",
      error: LOGIN_COPY.expired,
      tries: 0,
      busy: false,
      signup: { name: "Asha Rao", marketing: false },
    });
  });
  it("rate_limited in the profile keeps the form and shows the wait", () => {
    const sent = loginReducer(profile(), { type: "profileSubmit", values });
    expect(loginReducer(sent, fail("rate_limited", T, { retryAfterSec: 60 }))).toMatchObject({
      step: "profile",
      busy: false,
      error: "Too many attempts from this network. Try again in 1:00.",
    });
  });
  it("verifyOk is done", () => {
    expect(loginReducer(profile(), { type: "verifyOk", isNewUser: true })).toEqual({
      step: "done",
      isNewUser: true,
    });
    expect(loginReducer(codeStep(), { type: "verifyOk", isNewUser: false })).toEqual({
      step: "done",
      isNewUser: false,
    });
  });
});

describe("carry c: a network failure may still have signed in", () => {
  it("asks for a session check instead of showing an error", () => {
    const s = loginReducer(codeStep(), fail("network", T + 1000));
    expect(s).toMatchObject({
      step: "code",
      busy: true,
      sessionCheck: true,
      error: null,
      tries: 0,
    });
  });
  it("a session means signed in", () => {
    const s = loginReducer(loginReducer(codeStep(), fail("network", T)), {
      type: "sessionChecked",
      session: { name: "Asha" },
    });
    expect(s).toEqual({ step: "done", isNewUser: false });
  });
  it("no session shows the network error and frees the form", () => {
    const s = loginReducer(loginReducer(codeStep(), fail("network", T)), {
      type: "sessionChecked",
      session: null,
    });
    expect(s).toMatchObject({ busy: false, sessionCheck: false, error: LOGIN_COPY.network });
  });
  it("from the profile step a session means a new user", () => {
    const p = loginReducer(codeStep(), fail("signup_required", T));
    const sent = loginReducer(p, {
      type: "profileSubmit",
      values: { name: "Asha Rao", adult: true, termsPrivacy: true },
    });
    const checking = loginReducer(sent, fail("network", T));
    expect(checking).toMatchObject({ step: "profile", sessionCheck: true, busy: true });
    expect(loginReducer(checking, { type: "sessionChecked", session: { name: null } })).toEqual({
      step: "done",
      isNewUser: true,
    });
    expect(loginReducer(checking, { type: "sessionChecked", session: null })).toMatchObject({
      busy: false,
      error: LOGIN_COPY.network,
    });
  });
  it("a stray sessionChecked is ignored", () => {
    const s = codeStep();
    expect(loginReducer(s, { type: "sessionChecked", session: { name: null } })).toBe(s);
  });
});

describe("copy", () => {
  it("toasts", () => {
    expect(LOGIN_COPY.signedInToast("Asha")).toBe("Signed in as Asha");
    expect(LOGIN_COPY.signedInToast(null)).toBe("Signed in");
    expect(LOGIN_COPY.newCodeToast("+91 98765 43210")).toBe("New code sent to +91 98765 43210");
  });
});
