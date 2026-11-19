/**
 * The page's single polite live region (DESIGN.md "Focus, Targets and Assistive Tech"):
 * cart changes, search counts, toasts and busy states all speak through `announce()`.
 * Mount <LiveRegion/> once, at the end of <body> (src/app/layout.tsx); nothing else may
 * add an aria-live="polite" region of its own.
 */
export const LIVE_ID = "live";

/** Why the 50 ms gap: a screen reader ignores text that is unchanged, so clear first, then write. */
const ANNOUNCE_DELAY_MS = 50;

let pending: ReturnType<typeof setTimeout> | undefined;

/** Speak `message` politely. A newer call replaces one still waiting. No-op when no region is mounted. */
export function announce(message: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(LIVE_ID);
  if (!el) return;
  clearTimeout(pending);
  el.textContent = "";
  pending = setTimeout(() => {
    el.textContent = message;
  }, ANNOUNCE_DELAY_MS);
}

export function LiveRegion() {
  return <p id={LIVE_ID} className="sr-only" aria-live="polite" />;
}
