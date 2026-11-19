"use client";

// A client module: the busy state attaches a click handler to a plain <button>, and a server
// component cannot pass event handlers to DOM elements (the /dev/styleguide page failed on it).
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export type ButtonVariant =
  "sand" | "forest" | "quiet" | "ghost" | "danger" | "danger-quiet" | "link";
export type ButtonSize = "sm" | "md" | "lg";

type Look = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

/**
 * Class string for anything that should look like a button (a Link, a label...).
 * The `link` variant is the plain underlined text link (`.link`, 44px tall), not a pill, so it
 * returns "link" alone and ignores `size` and `block`: `btn-sm`/`btn-lg`/`btn-block` would
 * add pill padding and width that a text link must not have.
 */
export function buttonClass({ variant = "forest", size = "md", block = false }: Look = {}): string {
  if (variant === "link") return "link";
  return cn("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, block && "btn-block");
}

const ICON_PX = 18;

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
          {icon && <Icon name={icon} size={ICON_PX} />}
          {children}
        </>
      )}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & Look & { icon?: IconName }) {
  return (
    <Link {...rest} className={cn(buttonClass({ variant, size, block }), className)}>
      {icon && <Icon name={icon} size={ICON_PX} />}
      {children}
    </Link>
  );
}
