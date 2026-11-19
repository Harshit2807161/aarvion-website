"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { InputOTP } from "@/components/ui/input-otp";
import { cn } from "@/lib/cn";

export const OTP_LENGTH = 6;

/** The first six digits of whatever was pasted or autofilled ("482913 is your code…" gives "482913"). */
export function otpDigits(text: string): string {
  return text.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export type OtpState = "idle" | "invalid" | "locked";

const MOTION_QUERY = "(prefers-reduced-motion: no-preference)";

function subscribeMotion(notify: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener("change", notify);
  return () => mq.removeEventListener("change", notify);
}

function motionAllowed() {
  return typeof window.matchMedia === "function" && window.matchMedia(MOTION_QUERY).matches;
}

/**
 * One real, transparent <input> (autocomplete="one-time-code", inputmode="numeric", 16px so iOS
 * never zooms) drawn as six aria-hidden boxes. Paste and Android SMS autofill both deliver the
 * whole code: paste through input-otp's pasteTransformer (the autofill guard follows in the next PR).
 */
export function OtpField({
  id,
  value,
  onChange,
  onComplete,
  state,
  describedBy,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  state: OtpState;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Latest callbacks for the native listener and the once-per-code guard, without re-attaching.
  const cb = useRef({ onChange, onComplete });
  useEffect(() => {
    cb.current = { onChange, onComplete };
  });

  // onComplete fires once per distinct complete value: both input-otp's own completion effect and
  // the autofill path below can report the same code, and the guard resets once the code is edited.
  const completed = useRef<string | null>(null);
  const complete = (code: string) => {
    if (completed.current === code) return;
    completed.current = code;
    cb.current.onComplete(code);
  };
  useEffect(() => {
    if (value.length < OTP_LENGTH) completed.current = null;
  }, [value]);

  // Shake on invalid, only when motion is allowed. matchMedia is read through
  // useSyncExternalStore (false on the server and during hydration), never during render.
  const motionOk = useSyncExternalStore(subscribeMotion, motionAllowed, () => false);
  const shake = state === "invalid" && motionOk;

  return (
    <div
      className={cn(
        "otp",
        focused && "is-focused",
        state === "invalid" && "is-invalid",
        state === "locked" && "is-locked",
        shake && "shake",
      )}
    >
      <InputOTP
        ref={inputRef}
        id={id}
        className="otp-input"
        containerClassName="otp-boxes"
        maxLength={OTP_LENGTH}
        value={value}
        onChange={(v) => {
          cb.current.onChange(v);
        }}
        onComplete={(v: string) => complete(v)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={REGEXP_ONLY_DIGITS}
        pasteTransformer={otpDigits}
        disabled={state === "locked"}
        aria-invalid={state === "invalid" ? true : undefined}
        aria-describedby={describedBy}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        render={({ slots }) => (
          <>
            {slots.map((slot, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn("otp-box", slot.char && "is-filled", slot.isActive && "is-active")}
              >
                {slot.char}
              </span>
            ))}
          </>
        )}
      />
    </div>
  );
}
