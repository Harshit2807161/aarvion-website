import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "@/components/base/icon";
import { cn } from "@/lib/cn";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  id: string;
  label: ReactNode;
  /** Secondary line under the label, for example "Optional". */
  sub?: ReactNode;
  error?: string | null;
};

/**
 * A native checkbox drawn as a 24 px box inside a 44 px-tall label, so the whole row is the
 * target. The real input stays focusable and carries `aria-invalid` and the error link.
 */
export function Checkbox({ id, label, sub, error, className, ...input }: CheckboxProps) {
  const hasError = Boolean(error);
  return (
    <div>
      <label className={cn("check", hasError && "is-invalid", className)} htmlFor={id}>
        <input
          {...input}
          id={id}
          type="checkbox"
          className="check-input"
          aria-describedby={hasError ? `${id}-err` : undefined}
          aria-invalid={hasError ? true : undefined}
        />
        <span className="check-box" aria-hidden="true">
          <Icon name="check" size={18} />
        </span>
        <span className="check-text">
          {label}
          {sub ? <small>{sub}</small> : null}
        </span>
      </label>
      {hasError ? (
        <p className="field-err" id={`${id}-err`} role="alert">
          <Icon name="alert" size={18} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
