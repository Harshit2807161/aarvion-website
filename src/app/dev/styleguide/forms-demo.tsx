import { TextField } from "@/components/form/text-field";

/** Dev-only demo of the form fields in their default, hinted and errored states. */
export function FormsDemo() {
  return (
    <div className="form max-w-md">
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
      <TextField
        id="sg-bad"
        label="Pincode"
        mono
        defaultValue="4000"
        hint="Six digits."
        error="Enter a 6-digit pincode."
      />
    </div>
  );
}
