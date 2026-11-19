"use client";

// The only client module in the button family: the busy state attaches a click handler to a
// plain <button>, which a server component cannot render. buttonClass() and ButtonLink stay
// server-safe (button.tsx), and button.tsx re-exports Button so imports do not change.
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { BUTTON_ICON_PX, buttonClass, type Look } from "./button-class";
import { Icon, type IconName } from "./icon";

export function Button({
  variant,
  size,
  block,
  icon,
  busy = false,
  className,
  children,
  onClick,
  type = "button",
  ...rest
}: ComponentProps<"button"> & Look & { icon?: IconName; busy?: string | false }) {
  return (
    <button
      {...rest}
      type={type}
      className={cn(buttonClass({ variant, size, block }), busy !== false && "is-busy", className)}
      aria-busy={busy !== false ? true : undefined}
      aria-disabled={busy !== false ? true : rest["aria-disabled"]}
      // aria-disabled alone does not stop the browser: Enter, Space and implicit form submission
      // still fire a native click, and a submit button's click submits the form. A busy button
      // therefore swallows the click (preventDefault stops the submit) so checkout cannot send twice.
      onClick={
        busy !== false
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          : onClick
      }
    >
      {busy !== false ? (
        <>
          <span className="spin" aria-hidden="true" />
          {busy}
        </>
      ) : (
        <>
          {icon && <Icon name={icon} size={BUTTON_ICON_PX} />}
          {children}
        </>
      )}
    </button>
  );
}
