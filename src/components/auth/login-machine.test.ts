import { describe, expect, it } from "vitest";
import {
  LOGIN_COPY,
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
  it("Change returns to the id step with the identifier", () => {
    expect(loginReducer(codeStep(), { type: "change" })).toMatchObject({
      step: "id",
      raw: "9876543210",
      error: null,
    });
  });
});
