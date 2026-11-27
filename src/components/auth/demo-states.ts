/**
 * Demo states for the login flow (the prototype's `pages/login.html?state=…`), so a reviewer can
 * open each screen without a phone. `LoginFlow` applies one only when the page passes `allowDemo`
 * (`!isMockForbidden()`, so never in production) and `?state=` names one of them.
 *
 * Each state is reached by driving the real `loginReducer` from the start with fixture events,
 * never hand-built, so a demo can never show a state the machine could not reach.
 */
import { type LoginEvent, type LoginState, initialLoginState, loginReducer } from "./login-machine";

export const LOGIN_DEMO_STATES = ["otp-sent", "otp-error", "otp-locked", "new-account"] as const;
export type LoginDemoState = (typeof LOGIN_DEMO_STATES)[number];

/** The prototype's fixtures: a mobile number and the code shown in the boxes. */
export const DEMO_MOBILE = "9876543210";
export const DEMO_CODE = "482913";

/** How long the locked demo's countdown has left, as in the prototype (`startTimer(18)`). */
const LOCKED_WAIT_MS = 18_000;
const RESEND_MS = 30_000;

export function isLoginDemoState(v: string | null): v is LoginDemoState {
  return (LOGIN_DEMO_STATES as readonly string[]).includes(v ?? "");
}

/** The state for `name` at `now`, and the code to show in the boxes. */
export function demoLoginState(
  name: LoginDemoState,
  now: number,
): { state: LoginState; code: string } {
  const wrong: LoginEvent[] = [
    { type: "verifyStart" },
    { type: "verifyFail", error: "invalid_code", now, code: DEMO_CODE },
  ];
  // The locked demo's code was sent 12 s ago, so a new one may be asked for in 18 s.
  const sentAt = name === "otp-locked" ? now - (RESEND_MS - LOCKED_WAIT_MS) : now;
  const events: LoginEvent[] = [
    { type: "input", raw: DEMO_MOBILE },
    { type: "submitId" },
    { type: "sendOk", now: sentAt },
  ];
  if (name === "otp-error") events.push(...wrong);
  if (name === "otp-locked") for (let i = 0; i < 5; i++) events.push(...wrong);
  if (name === "new-account") {
    events.push(
      { type: "verifyStart" },
      { type: "verifyFail", error: "signup_required", now, code: DEMO_CODE },
    );
  }
  const state = events.reduce(loginReducer, initialLoginState());
  const code = name === "otp-error" || name === "otp-locked" ? DEMO_CODE : "";
  return { state, code };
}
