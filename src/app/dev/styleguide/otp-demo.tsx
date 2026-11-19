"use client";

import { useState } from "react";
import { OtpField, type OtpState } from "@/components/form/otp-field";

const STATES: OtpState[] = ["idle", "invalid", "locked"];

/** Styleguide demo: the OTP field in each state; the first is live (type, paste or autofill). */
export function OtpDemo() {
  const [value, setValue] = useState("");
  const [done, setDone] = useState("");
  return (
    <div className="flex flex-col gap-6">
      {STATES.map((state, i) => (
        <div key={state} className="flex flex-col gap-2">
          <label htmlFor={`sg-otp-${state}`}>
            <code>{state}</code>
            {i === 0 && " (type, paste or autofill a 6-digit code)"}
          </label>
          <OtpField
            id={`sg-otp-${state}`}
            value={i === 0 ? value : "48"}
            onChange={i === 0 ? setValue : () => {}}
            onComplete={i === 0 ? setDone : () => {}}
            state={state}
          />
        </div>
      ))}
      <p data-testid="sg-otp-complete">Completed: {done || "none yet"}</p>
    </div>
  );
}
