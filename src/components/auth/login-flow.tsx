"use client";

/**
 * The login flow (pages/login.html v2, lines 108-191) for the /login page and, later, the header
 * dialog. It owns `loginReducer`, the 1 s clock and the end of the flow, renders the id and done
 * steps and runs the send effect and the session check; the code step (`code-step.tsx`) runs
 * verify, resend and Change, and the profile step (`profile-step.tsx`) runs sign-up. With
 * `allowDemo`, `?state=` (read in an effect) opens a demo state from `demo-states.ts`.
 *
 * Rules kept here, each pinned by login-flow.test.tsx:
 * - Post exactly `identifierOf(...)`, the string the machine validated; the raw mobile input has
 *   no maxLength, because people type "+91 98765 43210".
 * - The id step has one field, so its error uses TextField's own `role="alert"`; there is no
 *   multi-field submit (and so no error summary) until the profile step.
 * - When a verify ends in `network`, the machine sets `sessionCheck`: call `fetchSession()` and
 *   dispatch `sessionChecked`, since the sign-in may have worked.
 * - On sign-in the done step shows "You’re signed in" and the dialog gets `onDone`; the page goes
 *   to `sanitizeNext(next)` 900 ms later, passed to `router.replace` undecoded. A visitor who is
 *   already signed in skips the done step and goes at once.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { Button } from "@/components/base/button";
import { Icon } from "@/components/base/icon";
import { announce } from "@/components/feedback/live-region";
import { Segmented } from "@/components/form/segmented";
import { TextField } from "@/components/form/text-field";
import { sanitizeNext } from "@/lib/next-url";
import { type Channel, fetchSession, sendCode } from "./api";
import { CodeStep } from "./code-step";
import { type LoginDemoState, demoLoginState, isLoginDemoState } from "./demo-states";
import { ProfileStep } from "./profile-step";
import {
  LOGIN_COPY,
  type LoginEvent,
  type LoginState,
  identifierOf,
  initialLoginState,
  loginReducer,
} from "./login-machine";

export type LoginDone = { isNewUser: boolean; name: string | null };

export type LoginFlowProps = {
  mode: "page" | "dialog";
  /** Shows the demo states where mocks are allowed (Task 42); the page passes `!isMockForbidden()`. */
  allowDemo?: boolean;
  /** Called once when the shopper is signed in. In page mode the flow then redirects to `next`. */
  onDone?(r: LoginDone): void;
  /** Where sign-in leads, when the opener knows (the header dialog); otherwise `?next=`. */
  next?: string;
};

/** The machine's reducer, plus the one event only a demo state may send: replace the state. */
function flowReducer(s: LoginState, e: LoginEvent | { type: "demo"; state: LoginState }) {
  return e.type === "demo" ? e.state : loginReducer(s, e);
}

const CHANNELS = [
  { value: "phone", label: LOGIN_COPY.mobile, icon: "phone" },
  { value: "email", label: LOGIN_COPY.email, icon: "mail" },
] as const;

/** How long "You’re signed in" shows before the page (or the dialog) moves on. */
export const DONE_MS = 900;

export function LoginFlow({ mode, allowDemo = false, onDone, next: nextProp }: LoginFlowProps) {
  const p = mode === "page" ? "pg" : "dlg";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(flowReducer, undefined, initialLoginState);
  const [now, setNow] = useState(() => Date.now());
  const sending = useRef(false);
  const name = useRef<string | null>(null);
  const finished = useRef(false);
  const focusNext = useRef<string | null>(null);

  const next = sanitizeNext(nextProp ?? searchParams.get("next"));
  const goNext = useEffectEvent(() => router.replace(next));
  const finish = useEffectEvent((r: LoginDone) => {
    if (finished.current) return;
    finished.current = true;
    onDone?.(r);
  });

  // Demo states: only where the page allows them (never in production) and only on request.
  const demoParam = allowDemo ? searchParams.get("state") : null;
  const demo = isLoginDemoState(demoParam) ? demoParam : null;
  // The code a demo shows in the boxes does not depend on time, so it is derived, not stored.
  const demoCode = demo ? demoLoginState(demo, 0).code : "";
  const openDemo = useEffectEvent((name: LoginDemoState) => {
    // Built at the flow's own clock, so the first countdown frame reads exactly.
    dispatch({ type: "demo", state: demoLoginState(name, now).state });
  });
  useEffect(() => {
    if (demo) openDemo(demo);
  }, [demo]);

  // Already signed in (another tab, or a back button): complete at once.
  useEffect(() => {
    let live = true;
    void fetchSession().then((s) => {
      if (!live || !s) return;
      finish({ isNewUser: false, name: s.name });
      if (mode === "page") goNext();
    });
    return () => {
      live = false;
    };
  }, [mode]);

  const doneNew = state.step === "done" ? state.isNewUser : null;
  useEffect(() => {
    if (doneNew === null) return;
    finish({ isNewUser: doneNew, name: name.current });
    document.getElementById(`${p}-done`)?.focus();
    if (mode !== "page") return;
    // Long enough to read "You’re signed in"; the timer (not `finish`) is re-armed under Strict Mode.
    const t = setTimeout(() => goNext(), DONE_MS);
    return () => clearTimeout(t);
  }, [doneNew, p, mode]);

  // A verify that ended in `network` may still have signed in: ask before showing the error.
  const sessionCheck = (state.step === "code" || state.step === "profile") && state.sessionCheck;
  useEffect(() => {
    if (!sessionCheck) return;
    let live = true;
    void fetchSession().then((session) => {
      if (!live) return;
      if (session) name.current = session.name;
      else announce(LOGIN_COPY.network);
      dispatch({ type: "sessionChecked", session });
    });
    return () => {
      live = false;
    };
  }, [sessionCheck]);

  // Countdowns and timed locks: the machine lifts a lock on `tick`.
  const ticking = state.step === "code" || state.step === "profile";
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: "tick", now: t });
    }, 1000);
    return () => clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const idInput = (channel: Channel) => `${p}-${channel === "phone" ? "mobile" : "email"}`;

  async function submitId(e: FormEvent) {
    e.preventDefault();
    if (state.step !== "id" || state.busy || sending.current) return;
    const next = loginReducer(state, { type: "submitId" });
    dispatch({ type: "submitId" });
    if (next.step !== "id" || !next.busy) {
      focusNext.current = idInput(state.channel);
      return;
    }
    sending.current = true;
    const started = Date.now();
    const r = await sendCode(state.channel, identifierOf(state.channel, state.raw));
    sending.current = false;
    setNow(Date.now());
    if (r.ok) {
      // The code clock starts when the request did, so it never lags the server's.
      dispatch({ type: "sendOk", now: started });
      return;
    }
    dispatch({ type: "sendFail", error: r.error, retryAfterSec: r.retryAfterSec, now: Date.now() });
    focusNext.current = idInput(state.channel);
  }

  return (
    <div className="auth" data-auth>
      {state.step === "id" ? (
        <div className="auth-step" data-step="id">
          <div className="auth-head">
            <h2 id={`${p}-title`} tabIndex={-1}>
              {LOGIN_COPY.idTitle}
            </h2>
            <p>{LOGIN_COPY.idSub}</p>
          </div>
          <Segmented
            name={`${p}-via`}
            legend={LOGIN_COPY.viaLegend}
            options={CHANNELS}
            value={state.channel}
            onChange={(channel) => dispatch({ type: "channel", channel })}
          />
          <form className="form" noValidate onSubmit={submitId}>
            {state.channel === "phone" ? (
              <TextField
                id={idInput("phone")}
                name="mobile"
                type="tel"
                label={LOGIN_COPY.mobileLabel}
                hint={LOGIN_COPY.mobileHint}
                prefix="+91"
                mono
                inputMode="numeric"
                autoComplete="tel-national"
                value={state.raw}
                error={state.error}
                onChange={(e) => dispatch({ type: "input", raw: e.target.value })}
              />
            ) : (
              <TextField
                id={idInput("email")}
                name="email"
                type="email"
                label={LOGIN_COPY.emailLabel}
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={state.raw}
                error={state.error}
                onChange={(e) => dispatch({ type: "input", raw: e.target.value })}
              />
            )}
            <Button type="submit" size="lg" block busy={state.busy ? LOGIN_COPY.sending : false}>
              {LOGIN_COPY.send}
            </Button>
          </form>
          <div className="auth-foot">
            <p>
              <Icon name="shield" size={18} />
              <span>{LOGIN_COPY.shield}</span>
            </p>
          </div>
        </div>
      ) : null}

      {state.step === "code" ? (
        <CodeStep
          p={p}
          s={state}
          initialCode={demoCode}
          now={now}
          dispatch={dispatch}
          setNow={setNow}
          onName={(n) => (name.current = n)}
          focus={(id) => (focusNext.current = id)}
          idInputId={idInput(state.channel)}
        />
      ) : null}

      {state.step === "profile" ? (
        <ProfileStep
          p={p}
          s={state}
          now={now}
          dispatch={dispatch}
          setNow={setNow}
          onName={(n) => (name.current = n)}
          focus={(id) => (focusNext.current = id)}
        />
      ) : null}

      {state.step === "done" ? (
        <div className="auth-step" data-step="done">
          <div className="auth-done">
            <span className="done-mark">
              <Icon name="check" size={28} />
            </span>
            <h2 id={`${p}-done`} tabIndex={-1}>
              {LOGIN_COPY.doneTitle}
            </h2>
            <p className="muted">
              {next.startsWith("/checkout") ? LOGIN_COPY.doneCheckout : LOGIN_COPY.doneDefault}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
