"use client";

/**
 * The page's single polite live region (DESIGN.md "Focus, Targets and Assistive Tech"):
 * cart changes, search counts, toasts and busy states all speak through `announce()`.
 * Mount <LiveRegion/> once, at the end of <body> (src/app/layout.tsx); nothing else may
 * add an aria-live="polite" region of its own.
 */
import { useId, useSyncExternalStore } from "react";

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

// Mounted instances, oldest first. Only the first renders the <p>: a second <LiveRegion/> would
// duplicate #live and add a second polite region, so it renders nothing (and takes over if the
// first unmounts). Registration happens in subscribe, i.e. at commit.
const owners: string[] = [];
const listeners = new Set<() => void>();

function register(id: string, notify: () => void) {
  owners.push(id);
  listeners.add(notify);
  listeners.forEach((l) => l());
  return () => {
    owners.splice(owners.indexOf(id), 1);
    listeners.delete(notify);
    if (owners.length === 0) clearTimeout(pending);
    listeners.forEach((l) => l());
  };
}

export function LiveRegion() {
  const id = useId();
  const owns = useSyncExternalStore(
    (notify) => register(id, notify),
    () => owners.length === 0 || owners[0] === id,
    () => true,
  );
  return owns ? <p id={LIVE_ID} className="sr-only" aria-live="polite" /> : null;
}
