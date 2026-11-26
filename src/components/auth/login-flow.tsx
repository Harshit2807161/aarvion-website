"use client";

/**
 * The login flow (pages/login.html v2, lines 108-191) for the /login page and, later, the header
 * dialog. It owns `loginReducer` and the end of the flow, renders the id step and
 * runs its send effect. The code step lands next (Task 41 part B); the profile and done steps and
 * the demo states (`allowDemo`) are Task 42. Both fill the seam marked below.
 *
 * Rules kept here, each pinned by login-flow.test.tsx:
 * - Post exactly `identifierOf(...)`, the string the machine validated; the raw mobile input has
 *   no maxLength, because people type "+91 98765 43210".
 * - The id step has one field, so its error uses TextField's own `role="alert"`; there is no
 *   multi-field submit (and so no error summary) until the profile step.
 * - On sign-in the page goes to `sanitizeNext(next)`, passed to `router.replace` undecoded; the
 *   dialog gets `onDone`. A visitor who is already signed in completes on mount.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useEffectEvent, useReducer, useRef } from "react";
import { Button } from "@/components/base/button";
import { Icon } from "@/components/base/icon";
import { Segmented } from "@/components/form/segmented";
import { TextField } from "@/components/form/text-field";
import { sanitizeNext } from "@/lib/next-url";
import { type Channel, fetchSession, sendCode } from "./api";
import { LOGIN_COPY, identifierOf, initialLoginState, loginReducer } from "./login-machine";

export type LoginDone = { isNewUser: boolean; name: string | null };

export type LoginFlowProps = {
  mode: "page" | "dialog";
  /** Shows the demo states where mocks are allowed (Task 42); the page passes `!isMockForbidden()`. */
  allowDemo?: boolean;
  /** Called once when the shopper is signed in. In page mode the flow then redirects to `next`. */
  onDone?(r: LoginDone): void;
};

const CHANNELS = [
  { value: "phone", label: LOGIN_COPY.mobile, icon: "phone" },
  { value: "email", label: LOGIN_COPY.email, icon: "mail" },
] as const;

export function LoginFlow({ mode, onDone }: LoginFlowProps) {
  const p = mode === "page" ? "pg" : "dlg";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(loginReducer, undefined, initialLoginState);
  const sending = useRef(false);
  const name = useRef<string | null>(null);
  const finished = useRef(false);
  const focusNext = useRef<string | null>(null);

  const finish = useEffectEvent((r: LoginDone) => {
    if (finished.current) return;
    finished.current = true;
    onDone?.(r);
    if (mode === "page") router.replace(sanitizeNext(searchParams.get("next")));
  });

  // Already signed in (another tab, or a back button): complete at once.
  useEffect(() => {
    let live = true;
    void fetchSession().then((s) => {
      if (live && s) finish({ isNewUser: false, name: s.name });
    });
    return () => {
      live = false;
    };
  }, []);

  const doneNew = state.step === "done" ? state.isNewUser : null;
  useEffect(() => {
    if (doneNew !== null) finish({ isNewUser: doneNew, name: name.current });
  }, [doneNew]);

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

      {/* Task 41 part B: the code step. Task 42: the profile (sign-up) and done steps. */}
    </div>
  );
}
