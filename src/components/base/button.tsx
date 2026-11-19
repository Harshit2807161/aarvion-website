// Server-safe: no "use client" here. Only Button (button.client.tsx) is a client module, so
// buttonClass() and ButtonLink can be used from server components. button.test.tsx asserts it.
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { BUTTON_ICON_PX, buttonClass, type Look } from "./button-class";
import { Icon, type IconName } from "./icon";

export { Button } from "./button.client";
export { buttonClass, type ButtonSize, type ButtonVariant } from "./button-class";

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
      {icon && <Icon name={icon} size={BUTTON_ICON_PX} />}
      {children}
    </Link>
  );
}
