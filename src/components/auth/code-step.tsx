"use client";

/**
 * The login flow's code step (pages/login.html v2, the `data-step="code"` block): the six-box
 * code, the resend countdown, the wrong-code and lock messages and Verify. `LoginFlow` owns the
 * machine; this step runs the verify effect and keeps what only it needs (the typed code, the
 * rejected code, the in-flight flag), so leaving the step drops all of it. "Send a new code" and
 * Change land with the /login page (Task 41 part C).
 *
 * Rules kept here, each pinned by login-flow.test.tsx:
 * - At most one verify in flight: the `verifying` ref plus the machine's `busy`. A code the
 *   server rejected is not sent again until it changes.
 * - A network or daily lock counts down from `lockedUntil` at render time (`liveCodeMessage`);
 *   the machine's own text for it is frozen at the moment of the 429.
 * - Messages are spoken through `announce()` (the page's single live region). `.auth-alert` has
 *   no role, so a countdown never re-announces every second.
 */
import { type Dispatch, useRef, useState } from "react";
import { Button } from "@/components/base/button";
import { Icon } from "@/components/base/icon";
import { announce } from "@/components/feedback/live-region";
import { OTP_LENGTH, OtpField } from "@/components/form/otp-field";
import { verifyCode } from "./api";
import {
  LOGIN_COPY,
  type LoginEvent,
  type LoginState,
  codeMessage,
  loginReducer,
  mmss,
  waitText,
} from "./login-machine";

export type CodeState = Extract<LoginState, { step: "code" }>;

/**
 * The code step's message at `now`. A network or daily lock is re-rendered from `lockedUntil`
 * so it stays live (the machine's `error` holds the text as it was at the 429).
 */
export function liveCodeMessage(s: LoginState, now: number): string | null {
  if (s.step !== "code") return null;
  if ((s.locked === "network" || s.locked === "daily") && s.lockedUntil !== null) {
    const left = Math.max(0, (s.lockedUntil - now) / 1000);
    return s.locked === "network"
      ? LOGIN_COPY.verifyRateLimited(mmss(left))
      : LOGIN_COPY.daily(s.channel === "phone" ? "number" : "email", waitText(left));
  }
  return codeMessage(s, now);
}

export function CodeStep({
  p,
  s,
  now,
  dispatch,
  setNow,
  onName,
}: {
  /** Id prefix: "pg" on the page, "dlg" in the dialog. */
  p: string;
  s: CodeState;
  now: number;
  dispatch: Dispatch<LoginEvent>;
  /** Restarts the flow's clock at a result, so a countdown starts exact. */
  setNow(t: number): void;
  /** The verified customer's name, kept for `onDone`. */
  onName(name: string | null): void;
}) {
  const [code, setCode] = useState("");
  const verifying = useRef(false);
  const rejected = useRef<string | null>(null);

  async function verify(value: string) {
    if (s.busy || s.locked || verifying.current) return;
    if (value.length < OTP_LENGTH) return;
    if (value === rejected.current) {
      // Not sent again; say why nothing happened (the message on screen still applies).
      const m = liveCodeMessage(s, now);
      if (m) announce(m);
      return;
    }
    verifying.current = true;
    dispatch({ type: "verifyStart" });
    const r = await verifyCode(s.channel, s.identifier, value, s.signup ?? undefined);
    verifying.current = false;
    const t = Date.now();
    setNow(t);
    if (r.ok) {
      onName(r.user.name);
      dispatch({ type: "verifyOk", isNewUser: r.isNewUser });
      return;
    }
    if (r.error === "invalid_code") rejected.current = value;
    const fail = {
      type: "verifyFail",
      error: r.error,
      retryAfterSec: r.retryAfterSec,
      now: t,
      code: value,
    } as const;
    // Busy ignored every event but results, so the state the result lands on is predictable.
    const after = loginReducer({ ...s, busy: true, error: null }, fail);
    dispatch(fail);
    const message = liveCodeMessage(after, t);
    if (message) announce(message);
  }

  const message = liveCodeMessage(s, now);
  const waiting = now < s.resendAt;
  const otpState = s.locked ? "locked" : message && !s.busy ? "invalid" : "idle";
  return (
    <div className="auth-step" data-step="code">
      <div className="auth-head">
        <h2 tabIndex={-1}>{LOGIN_COPY.codeTitle}</h2>
        <p className="auth-sent">
          <span id={`${p}-sent`}>
            {LOGIN_COPY.codeSent} <b>{s.sentTo}</b>.
          </span>
        </p>
      </div>
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
      >
        <div className="field">
          <label className="label" htmlFor={`${p}-otp`}>
            {LOGIN_COPY.codeLabel}
          </label>
          <OtpField
            id={`${p}-otp`}
            value={code}
            onChange={setCode}
            onComplete={(v) => void verify(v)}
            state={otpState}
            describedBy={`${p}-sent ${p}-otp-hint${message ? ` ${p}-otp-err` : ""}`}
            autoFocus
          />
          <p className="hint" id={`${p}-otp-hint`}>
            {LOGIN_COPY.codeHint}
          </p>
          {message ? (
            <p className="auth-alert" id={`${p}-otp-err`}>
              <Icon name="alert" size={18} />
              <span>{message}</span>
            </p>
          ) : null}
        </div>
        <div className="otp-meta">
          {waiting ? (
            <span className="otp-timer">
              {LOGIN_COPY.resendIn} <span className="mono">{mmss((s.resendAt - now) / 1000)}</span>
            </span>
          ) : null}
        </div>
        {s.locked ? null : (
          <Button type="submit" size="lg" block busy={s.busy ? LOGIN_COPY.verifying : false}>
            {LOGIN_COPY.verify}
          </Button>
        )}
      </form>
    </div>
  );
}
