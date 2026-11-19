import { describe, expect, it } from "vitest";
import {
  LOGIN_COPY,
  codeMessage,
  identifierOf,
  initialLoginState,
  loginReducer,
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
/** A code step with a resend in flight. */
const resending = (from: LoginState = codeStep()) => loginReducer(from, { type: "resendStart" });

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
  it("refuses a number that is not exactly ten digits after the prefix (never truncates)", () => {
    for (const raw of ["98765543210", "091 98765 43210", "98765432101", "98765 432109"]) {
      expect(run([{ type: "input", raw }, { type: "submitId" }])).toMatchObject({
        step: "id",
        error: LOGIN_COPY.mobileInvalid,
        busy: false,
      });
    }
  });
  it("N2: refuses a stray character or a script digit typo, and reads script digits as typed", () => {
    for (const raw of ["98765O43210", "९8765432101", "９9876543210"]) {
      expect(run([{ type: "input", raw }, { type: "submitId" }])).toMatchObject({
        error: LOGIN_COPY.mobileInvalid,
        busy: false,
      });
    }
    expect(run([{ type: "input", raw: "९९९९९९९९९९" }, { type: "submitId" }])).toMatchObject({
      busy: true,
    });
    expect(identifierOf("phone", "९९९९९९९९९९")).toBe("9999999999");
  });
  it("accepts the usual ways of writing one number, and posts the same ten digits", () => {
    for (const raw of ["+91 98765 43210", "09876543210", "919876543210", "98765-43210"]) {
      expect(run([{ type: "input", raw }, { type: "submitId" }])).toMatchObject({ busy: true });
      expect(identifierOf("phone", raw)).toBe("9876543210");
    }
    expect(identifierOf("email", " Asha@Example.com ")).toBe("asha@example.com");
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

describe("busy is a guard", () => {
  const sending = () => run([{ type: "input", raw: "9876543210" }, { type: "submitId" }]);
  it("a double submit is a no-op (same object)", () => {
    const s = sending();
    expect(loginReducer(s, { type: "submitId" })).toBe(s);
  });
  it("ignores input and channel changes while a send is in flight", () => {
    const s = sending();
    expect(loginReducer(s, { type: "input", raw: "9000000000" })).toBe(s);
    expect(loginReducer(s, { type: "channel", channel: "email" })).toBe(s);
  });
  it("ignores a send result when nothing is in flight", () => {
    const idle = run([{ type: "input", raw: "9876543210" }]);
    expect(loginReducer(idle, { type: "sendOk", now: T })).toBe(idle);
    expect(loginReducer(idle, { type: "sendFail", error: "network", now: T })).toBe(idle);
    const code = codeStep();
    expect(loginReducer(code, { type: "sendOk", now: T + 5 })).toBe(code);
  });
  it("a late result after the request finished changes nothing", () => {
    const code = codeStep();
    expect(loginReducer(code, { type: "sendFail", error: "network", now: T + 1 })).toBe(code);
  });
  it("ignores Change while a resend is in flight, so a late result still matches its request", () => {
    const r = resending();
    expect(loginReducer(r, { type: "change" })).toBe(r);
  });
  it("ignores resend and verify starts while busy", () => {
    const r = resending();
    expect(loginReducer(r, { type: "resendStart" })).toBe(r);
    expect(loginReducer(r, { type: "verifyStart" })).toBe(r);
    const v = loginReducer(codeStep(), { type: "verifyStart" });
    expect(loginReducer(v, { type: "verifyStart" })).toBe(v);
    expect(loginReducer(v, { type: "resendStart" })).toBe(v);
  });
  it("ignores a verify result when no verify is in flight", () => {
    const s = codeStep();
    expect(loginReducer(s, fail("invalid_code", T + 1))).toBe(s);
    expect(loginReducer(s, { type: "verifyOk", isNewUser: false })).toBe(s);
  });
});

describe("sending", () => {
  const sending = () => run([{ type: "input", raw: "9876543210" }, { type: "submitId" }]);
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
  it("resend_cooldown on the id step means a live code exists: go to the code step", () => {
    const s = loginReducer(sending(), {
      type: "sendFail",
      error: "resend_cooldown",
      retryAfterSec: 22,
      now: T,
    });
    expect(s).toMatchObject({
      step: "code",
      identifier: "9876543210",
      resendAt: T + 22_000,
      sentAt: T + 22_000 - 30_000,
      error: null,
      busy: false,
    });
    const noWait = loginReducer(sending(), { type: "sendFail", error: "resend_cooldown", now: T });
    expect(noWait).toMatchObject({ step: "code", resendAt: T + 30_000 });
    expect(JSON.stringify(noWait)).not.toContain("NaN");
  });
  it("Change returns to the id step with the identifier", () => {
    expect(loginReducer(codeStep(), { type: "change" })).toMatchObject({
      step: "id",
      raw: "9876543210",
      error: null,
    });
  });
});

describe("resend", () => {
  it("resets the code clock and tries, and keeps the sign-up details", () => {
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
  it("I4/N1: a resend is refused under a daily or network lock, and the lock message stays", () => {
    for (const [error, retryAfterSec] of [
      ["too_many_attempts", 80_000],
      ["rate_limited", 900],
    ] as const) {
      const locked = run([{ type: "verifyStart" }, fail(error, T, { retryAfterSec })], codeStep());
      expect(loginReducer(locked, { type: "resendStart" })).toBe(locked);
      expect(codeMessage(locked, T + 1000)).toMatch(/Try again in/);
      // Defence in depth: a stray send result cannot lift the lock either.
      if (locked.step !== "code") throw new Error("expected the code step");
      const s = loginReducer({ ...locked, busy: true }, { type: "sendOk", now: T + 40_000 });
      expect(s).toMatchObject({ tries: 0, locked: locked.locked, lockedUntil: locked.lockedUntil });
    }
  });
  it("I2: a resend that cannot be delivered goes back to the id step with the message", () => {
    const s = loginReducer(resending(), {
      type: "sendFail",
      error: "delivery_failed",
      now: T + 40_000,
    });
    expect(s).toEqual({
      step: "id",
      channel: "phone",
      raw: "9876543210",
      error: "We couldn’t send the code. Try again, or use your email instead.",
      busy: false,
    });
  });
  it("I3: a resend failure shows even while the code is locked for wrong tries", () => {
    const locked = run(
      Array.from({ length: 5 }, () => [
        { type: "verifyStart" } as const,
        fail("invalid_code", T + 1000),
      ]).flat(),
      codeStep(),
    );
    expect(codeMessage(locked, T + 40_000)).toBe(LOGIN_COPY.lockedReady);
    const s = loginReducer(resending(locked), {
      type: "sendFail",
      error: "network",
      now: T + 40_000,
    });
    expect(s).toMatchObject({ step: "code", locked: "tries", busy: false });
    expect(codeMessage(s, T + 40_000)).toBe(LOGIN_COPY.network);
  });
  it("N3: a rate-limited resend moves the countdown and leaves no stale text", () => {
    const s = loginReducer(resending(), {
      type: "sendFail",
      error: "rate_limited",
      retryAfterSec: 600,
      now: T + 40_000,
    });
    expect(s).toMatchObject({ step: "code", resendAt: T + 40_000 + 600_000, error: null });
    const locked = run(
      Array.from({ length: 5 }, () => [
        { type: "verifyStart" } as const,
        fail("invalid_code", T + 1000),
      ]).flat(),
      codeStep(),
    );
    const l = loginReducer(resending(locked), {
      type: "sendFail",
      error: "rate_limited",
      retryAfterSec: 300,
      now: T + 40_000,
    });
    expect(codeMessage(l, T + 40_000)).toBe(LOGIN_COPY.lockedWait("5:00"));
    expect(codeMessage(l, T + 340_000)).toBe(LOGIN_COPY.lockedReady);
  });
  it("a resend_cooldown failure moves the countdown and shows no error", () => {
    const s = loginReducer(resending(), {
      type: "sendFail",
      error: "resend_cooldown",
      retryAfterSec: 12,
      now: T + 1000,
    });
    expect(s).toMatchObject({ step: "code", busy: false, resendAt: T + 13_000, error: null });
  });
});

describe("wrong codes", () => {
  const verifying = () => loginReducer(codeStep(), { type: "verifyStart" });
  it("counts down and locks on the last try", () => {
    let s = verifying();
    s = loginReducer(s, fail("invalid_code", T + 10_000));
    expect(s).toMatchObject({ tries: 1, error: "That code doesn’t match. 4 tries left." });
    s = run(
      [
        { type: "verifyStart" },
        fail("invalid_code", T + 10_000),
        { type: "verifyStart" },
        fail("invalid_code", T + 10_000),
        { type: "verifyStart" },
        fail("invalid_code", T + 10_000),
      ],
      s,
    );
    expect(s).toMatchObject({ tries: 4, error: "That code doesn’t match. 1 try left." });
    s = run([{ type: "verifyStart" }, fail("invalid_code", T + 10_000)], s);
    expect(s).toMatchObject({ tries: 5, locked: "tries" });
    expect(codeMessage(s, T + 20_000)).toBe(LOGIN_COPY.lockedWait("0:10"));
    expect(codeMessage(s, T + 30_000)).toBe(LOGIN_COPY.lockedReady);
  });
  it("an expired code says so and does not count a try", () => {
    const s = loginReducer(verifying(), fail("invalid_code", T + 300_000));
    expect(s).toMatchObject({ tries: 0, error: LOGIN_COPY.expired, locked: null, busy: false });
  });
  it("a locked code ignores verifyStart", () => {
    const s = run(
      Array.from({ length: 5 }, () => [
        { type: "verifyStart" } as const,
        fail("invalid_code", T + 1000),
      ]).flat(),
      codeStep(),
    );
    expect(loginReducer(s, { type: "verifyStart" })).toBe(s);
  });
});

describe("server limits", () => {
  const verifying = (s: LoginState = codeStep()) => loginReducer(s, { type: "verifyStart" });
  it("too_many_attempts locks for the day", () => {
    const s = loginReducer(verifying(), fail("too_many_attempts", T, { retryAfterSec: 3600 }));
    expect(s).toMatchObject({
      locked: "daily",
      lockedUntil: T + 3_600_000,
      error: "Too many wrong codes for this number today. Try again in 1 hour.",
    });
    const e = loginReducer(
      verifying(codeStep("email")),
      fail("too_many_attempts", T, { retryAfterSec: 1500 }),
    );
    expect(e).toMatchObject({
      error: "Too many wrong codes for this email today. Try again in 25 minutes.",
    });
  });
  it("rate_limited (C3) blocks Verify without spending a try", () => {
    const s = loginReducer(verifying(), fail("rate_limited", T, { retryAfterSec: 900 }));
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
    const s = loginReducer(verifying(), fail("rate_limited", T));
    expect(s).toMatchObject({
      error: "Too many attempts from this network. Try again in a little while.",
      lockedUntil: T + 60_000,
    });
    const d = loginReducer(verifying(), fail("too_many_attempts", T, { retryAfterSec: NaN }));
    expect(d).toMatchObject({
      error: "Too many wrong codes for this number today. Try again in a little while.",
      lockedUntil: T + 60_000,
    });
    expect(JSON.stringify(d)).not.toContain("NaN");
  });
});
