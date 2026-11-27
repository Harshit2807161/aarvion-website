import type { InputHTMLAttributes } from "react";
import { Icon } from "@/components/base/icon";
import { cn } from "@/lib/cn";

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "prefix"> & {
  id: string;
  /** Always visible: a placeholder is never the label. */
  label: string;
  hint?: string;
  /** The message to show; `null`/`undefined`/"" means the field is valid. */
  error?: string | null;
  /**
   * The error is announced with `role="alert"` (default). Pass false when an `ErrorSummary`
   * speaks for the form, so one submit never fires several assertive alerts.
   */
  errorAlert?: boolean;
  /** A fixed leading mark such as "+91"; decorative, so hidden from assistive tech. */
  prefix?: string;
  mono?: boolean;
};

/**
 * A labelled text input (52 px tall, 16 px text so iOS never zooms). The hint and the error are
 * tied to the input with `aria-describedby`; an error also sets `aria-invalid`.
 */
export function TextField({
  id,
  label,
  hint,
  error,
  errorAlert = true,
  prefix,
  mono,
  className,
  "aria-describedby": extraDescribedBy,
  ...input
}: TextFieldProps) {
  const hasError = Boolean(error);
  const describedBy =
    [hint ? `${id}-hint` : null, hasError ? `${id}-err` : null, extraDescribedBy]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className={cn("field", hasError && "is-invalid")}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className={cn("input-wrap", prefix && "has-prefix")}>
        {prefix ? (
          <span className="prefix" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        <input
          {...input}
          id={id}
          className={cn("field-box", "input", mono && "mono", className)}
          aria-describedby={describedBy}
          aria-invalid={hasError ? true : undefined}
        />
      </div>
      {hint ? (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p className="field-err" id={`${id}-err`} role={errorAlert ? "alert" : undefined}>
          <Icon name="alert" size={18} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
