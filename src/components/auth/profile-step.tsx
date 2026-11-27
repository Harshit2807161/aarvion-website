"use client";

/**
 * The login flow's sign-up step (pages/login.html v2, the `data-step="profile"` block), shown when
 * a verified code belongs to no account yet (409 `signup_required`). It asks for the full name and
 * the two required consents, plus the optional marketing one, then re-sends the held code with
 * the details (`verifyCode(..., signup)`), as the machine's header comment describes.
 *
 * Rules kept here, each pinned by login-flow.test.tsx:
 * - A submit that invalidates two or more fields shows one `ErrorSummary` that takes focus, and
 *   the fields drop their own `role="alert"`; a single invalid field keeps its alert and takes
 *   focus itself. The server refusing the name (`nameRefused`) and a name over 80 characters
 *   (`nameTooLong`) land on the name field.
 * - The terms consent is required here (the prototype only had a line of text): its label links
 *   to the Terms of use and the Privacy policy through ROUTES, opening in a new tab so the held
 *   code is not lost; each link says so to assistive tech (`LOGIN_COPY.newTab`, visually hidden).
 * - A rate limit counts down live from `lockedUntil`; other messages are spoken via `announce()`.
 */
import Link from "next/link";
import { type Dispatch, type FormEvent, type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/base/button";
import { Icon } from "@/components/base/icon";
import { announce } from "@/components/feedback/live-region";
import { Checkbox } from "@/components/form/checkbox";
import { ErrorSummary } from "@/components/form/error-summary";
import { TextField } from "@/components/form/text-field";
import { ROUTES } from "@/config/routes";
import { verifyCode } from "./api";
import { liveCodeMessage } from "./code-step";
import { LOGIN_COPY, type LoginEvent, type LoginState, loginReducer, mmss } from "./login-machine";

type ProfileState = Extract<LoginState, { step: "profile" }>;

/** The consent copy with "Terms of use" and "Privacy policy" turned into links; text verbatim. */
function withLegalLinks(text: string): ReactNode[] {
  const href: Record<string, string> = {
    "Terms of use": ROUTES.legal.terms,
    "Privacy policy": ROUTES.legal.privacy,
  };
  return text.split(/(Terms of use|Privacy policy)/).map((part, i) =>
    href[part] ? (
      <Link key={i} href={href[part]} target="_blank" rel="noopener">
        {part}
        <span className="sr-only"> {LOGIN_COPY.newTab}</span>
      </Link>
    ) : (
      part
    ),
  );
}

/** The profile step's message at `now`: a rate limit counts down from `lockedUntil`. */
function liveProfileMessage(s: LoginState, now: number): string | null {
  if (s.step !== "profile") return null;
  if (s.lockedUntil !== null) {
    return LOGIN_COPY.verifyRateLimited(mmss(Math.max(0, (s.lockedUntil - now) / 1000)));
  }
  return s.error;
}

export function ProfileStep({
  p,
  s,
  now,
  dispatch,
  setNow,
  onName,
  focus,
}: {
  p: string;
  s: ProfileState;
  now: number;
  dispatch: Dispatch<LoginEvent>;
  setNow(t: number): void;
  onName(name: string | null): void;
  /** Focuses the element with this id after the next render. */
  focus(id: string): void;
}) {
  // Refilled from the details already sent, so a refused name can be corrected in place.
  const [name, setName] = useState(s.signup?.name ?? "");
  const [adult, setAdult] = useState(s.signup?.adult ?? false);
  const [terms, setTerms] = useState(s.signup?.termsPrivacy ?? false);
  const [marketing, setMarketing] = useState(s.signup?.marketing ?? false);
  const [submits, setSubmits] = useState(0);
  const sending = useRef(false);

  const ids = { name: `${p}-name`, adult: `${p}-adult`, termsPrivacy: `${p}-terms` } as const;
  const errors = (["name", "adult", "termsPrivacy"] as const).flatMap((k) =>
    s.fieldErrors[k] ? [{ id: ids[k], message: s.fieldErrors[k] }] : [],
  );
  const summary = errors.length >= 2;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (s.busy || sending.current || s.lockedUntil !== null) return;
    const values = { name, adult, termsPrivacy: terms, marketing };
    const next = loginReducer(s, { type: "profileSubmit", values });
    dispatch({ type: "profileSubmit", values });
    setSubmits((n) => n + 1);
    if (next.step !== "profile" || !next.busy || !next.signup) {
      // One invalid field: its own alert speaks, and focus goes to it. Two or more: the summary.
      const bad = next.step === "profile" ? Object.keys(next.fieldErrors) : [];
      if (bad.length === 1) focus(ids[bad[0] as keyof typeof ids]);
      return;
    }
    sending.current = true;
    const r = await verifyCode(s.channel, s.identifier, s.code, next.signup);
    sending.current = false;
    const t = Date.now();
    setNow(t);
    if (r.ok) {
      onName(r.user.name);
      dispatch({ type: "verifyOk", isNewUser: r.isNewUser });
      return;
    }
    const fail = {
      type: "verifyFail",
      error: r.error,
      retryAfterSec: r.retryAfterSec,
      now: t,
      code: s.code,
    } as const;
    // Busy ignored every event but results, so the state the result lands on is predictable.
    const after = loginReducer(next, fail);
    dispatch(fail);
    if (after.step === "profile" && after.fieldErrors.name) focus(ids.name);
    const message = liveProfileMessage(after, t) ?? liveCodeMessage(after, t);
    if (message) announce(message);
  }

  const message = liveProfileMessage(s, now);
  return (
    <div className="auth-step" data-step="profile">
      <div className="auth-head">
        <h2 tabIndex={-1}>{LOGIN_COPY.profileTitle}</h2>
        <p>
          <b>{s.sentTo}</b> {LOGIN_COPY.profileSub}
        </p>
      </div>
      <form className="form" noValidate onSubmit={submit}>
        <ErrorSummary errors={summary ? errors : []} focusKey={submits} />
        <TextField
          id={ids.name}
          name="name"
          label={LOGIN_COPY.nameLabel}
          autoComplete="name"
          autoFocus
          value={name}
          error={s.fieldErrors.name}
          errorAlert={!summary}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <Checkbox
            id={ids.adult}
            label={LOGIN_COPY.adult}
            checked={adult}
            error={s.fieldErrors.adult}
            errorAlert={!summary}
            onChange={(e) => setAdult(e.target.checked)}
          />
          <Checkbox
            id={ids.termsPrivacy}
            label={withLegalLinks(LOGIN_COPY.terms)}
            checked={terms}
            error={s.fieldErrors.termsPrivacy}
            errorAlert={!summary}
            onChange={(e) => setTerms(e.target.checked)}
          />
          <Checkbox
            id={`${p}-news`}
            label={LOGIN_COPY.marketing}
            sub={LOGIN_COPY.marketingSub}
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
          />
        </div>
        {message ? (
          <p className="auth-alert">
            <Icon name="alert" size={18} />
            <span>{message}</span>
          </p>
        ) : null}
        <Button type="submit" size="lg" block busy={s.busy ? LOGIN_COPY.creating : false}>
          {LOGIN_COPY.create}
        </Button>
      </form>
    </div>
  );
}
