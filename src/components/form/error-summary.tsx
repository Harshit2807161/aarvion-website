"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "@/components/base/icon";

/**
 * Titles verbatim from the prototype's error summary (design/prototype/js/flows.js `errSummary`).
 * Added in Task 42 with the first form that can fail on several fields; awaiting owner approval.
 */
export const ERROR_SUMMARY_COPY = {
  one: "There’s a problem",
  many: (n: number) => `There are ${n} problems`,
} as const;

export type SummaryError = { id: string; message: string };

/**
 * The error summary DESIGN.md asks for on submit: a danger-50 box with a danger-200 edge that
 * lists each problem as a link to its field and takes focus, so a screen reader reads it once.
 * It is neither a live region nor an alert; the fields it covers pass `errorAlert={false}`.
 * `focusKey` changes on every submit, so a repeat submit with the same errors focuses it again.
 */
export function ErrorSummary({ errors, focusKey }: { errors: SummaryError[]; focusKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const shown = errors.length > 0;
  useEffect(() => {
    if (shown) ref.current?.focus();
  }, [shown, focusKey]);
  if (!shown) return null;
  return (
    <div ref={ref} className="errsum" tabIndex={-1} role="group" aria-labelledby={titleId}>
      <p className="errsum-title" id={titleId}>
        <Icon name="alert" size={22} />
        {errors.length === 1 ? ERROR_SUMMARY_COPY.one : ERROR_SUMMARY_COPY.many(errors.length)}
      </p>
      <ul>
        {errors.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              onClick={(ev) => {
                // Focus the field itself; the hash alone would scroll without moving focus.
                const el = document.getElementById(e.id);
                if (!el) return;
                ev.preventDefault();
                el.scrollIntoView?.({ block: "center" });
                el.focus({ preventScroll: true });
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
