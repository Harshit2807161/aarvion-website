"use client";

import { useState } from "react";
import { Checkbox } from "@/components/form/checkbox";
import { Segmented } from "@/components/form/segmented";
import { TextField } from "@/components/form/text-field";

/** Dev-only demo of the form fields in their default, hinted, errored and checked states. */
export function FormsDemo() {
  const [via, setVia] = useState<"mobile" | "email">("mobile");
  return (
    <div className="form max-w-md">
      <Segmented
        name="sg-via"
        legend="Sign in with"
        value={via}
        onChange={setVia}
        options={[
          { value: "mobile", label: "Mobile", icon: "user" },
          { value: "email", label: "Email", icon: "mail" },
        ]}
      />
      <TextField
        id="sg-mobile"
        label="Mobile number"
        prefix="+91"
        mono
        type="tel"
        inputMode="numeric"
        placeholder="98765 43210"
        hint="Indian mobile numbers (+91) only."
      />
      <TextField id="sg-name" label="Full name" placeholder="Example name" />
      <TextField id="sg-bad" label="Pincode" mono defaultValue="4000" error="Enter 6 digits." />
      <div>
        <Checkbox id="sg-adult" label="I am 18 or older" defaultChecked />
        <Checkbox id="sg-news" label="Tell me about new medicines" sub="Optional." />
        <Checkbox
          id="sg-terms"
          label="I agree to the Terms"
          error="Accept the terms to continue."
        />
      </div>
    </div>
  );
}
