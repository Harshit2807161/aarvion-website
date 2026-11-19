import { cn } from "@/lib/cn";

// Shared by Button (client) and ButtonLink (server): pure, so no directive and no React.
export type ButtonVariant =
  "sand" | "forest" | "quiet" | "ghost" | "danger" | "danger-quiet" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export type Look = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

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

export const BUTTON_ICON_PX = 18;
