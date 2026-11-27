/**
 * The reduced-motion media queries and readers every client module shares. Both queries exist
 * because the repo has always asked each question the way its CSS does: `reduce` for "turn the
 * movement off" (smooth scroll, drag dismiss, the banner), `no-preference` for "motion is
 * allowed" (the film, the OTP shake, rail scrolling). Callers read them inside effects or
 * handlers, never during render, so a server render never touches `window`.
 *
 * The film's inline flag script (`film-root.tsx`) runs before React and keeps its own literal.
 */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const MOTION_ALLOWED_QUERY = "(prefers-reduced-motion: no-preference)";

function matches(query: string): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query).matches
    : false;
}

/** True when the visitor asked for less motion. False where matchMedia is missing. */
export function prefersReducedMotion(): boolean {
  return matches(REDUCED_MOTION_QUERY);
}

/** True when the visitor expressed no preference, so motion is allowed. False where matchMedia is missing. */
export function motionAllowed(): boolean {
  return matches(MOTION_ALLOWED_QUERY);
}
