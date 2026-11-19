"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { InputOTP } from "@/components/ui/input-otp";
import { cn } from "@/lib/cn";

export const OTP_LENGTH = 6;

/** The first six digits of whatever was pasted or autofilled ("482913 is your code…" gives "482913"). */
export function otpDigits(text: string): string {
  return text.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export type OtpState = "idle" | "invalid" | "locked";

// DESIGN.md asks for pattern="[0-9]*". input-otp also uses the pattern as a regex to reject input,
// where an unanchored [0-9]* would accept anything, so it is anchored: same digits-only meaning.
const OTP_PATTERN = "^[0-9]*$";

const AUTOFILL_INPUT_TYPES = new Set(["insertText", "insertReplacementText", "insertFromPaste"]);

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
 * never zooms) drawn as six aria-hidden boxes. A pasted code is handled twice over: a native
 * paste listener takes a whole 6-digit code and replaces the value (input-otp would insert it at
 * the caret and truncate: "48" + "482913" gives "484829"), and input-otp's pasteTransformer
 * cleans partial pastes. The beforeinput guard below takes Android SMS autofill.
 *
 * Name the input with a <label for={id}>, or pass `ariaLabel` when there is no visible label.
 */
export function OtpField({
  id,
  value,
  onChange,
  onComplete,
  state,
  describedBy,
  autoFocus,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  state: OtpState;
  describedBy?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Latest callbacks for the native listener and the once-per-code guard, without re-attaching.
  const cb = useRef({ onChange, onComplete });
  useEffect(() => {
    cb.current = { onChange, onComplete };
  });

  // onComplete fires once per distinct complete value: both input-otp's own completion effect and
  // the native paste listener below can report the same code, and the guard resets once the code is edited.
  const completed = useRef<string | null>(null);
  const complete = (code: string) => {
    if (completed.current === code) return;
    completed.current = code;
    cb.current.onComplete(code);
  };
  useEffect(() => {
    if (value.length < OTP_LENGTH) completed.current = null;
  }, [value]);

  // Native listeners on the real input (React's onBeforeInput never carries the native
  // `inputType` [C18], and input-otp's own paste handler runs before React's onPaste).
  //
  // beforeinput: Android SMS autofill and keyboard suggestions insert the whole code as one text
  // insertion at the caret. With a partial value already typed, maxlength would truncate it
  // ("12" + "482913" gives "124829"), so take the digits instead.
  //
  // paste: a pasted full code replaces the value. Stopping the native event keeps input-otp's
  // own paste handler (and its completion effect) from also seeing a truncated value; partial
  // pastes still reach it.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onPaste = (e: ClipboardEvent) => {
      const digits = otpDigits(e.clipboardData?.getData("text/plain") ?? "");
      if (digits.length !== OTP_LENGTH) return;
      e.preventDefault();
      e.stopPropagation();
      cb.current.onChange(digits);
      complete(digits);
    };
    const onBeforeInput = (e: Event) => {
      const ev = e as InputEvent;
      if (!AUTOFILL_INPUT_TYPES.has(ev.inputType)) return;
      const digits = otpDigits(ev.data ?? "");
      if (digits.length !== OTP_LENGTH) return;
      ev.preventDefault();
      cb.current.onChange(digits);
      complete(digits);
    };
    input.addEventListener("paste", onPaste);
    input.addEventListener("beforeinput", onBeforeInput);
    return () => {
      input.removeEventListener("paste", onPaste);
      input.removeEventListener("beforeinput", onBeforeInput);
    };
    // `complete` only touches refs, so the listeners are attached once.
  }, []);

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
        pattern={OTP_PATTERN}
        pasteTransformer={otpDigits}
        disabled={state === "locked"}
        aria-invalid={state === "invalid" ? true : undefined}
        aria-label={ariaLabel}
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
