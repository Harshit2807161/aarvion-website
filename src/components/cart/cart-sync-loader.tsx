"use client";

import { useEffect, useState, type ComponentType } from "react";

/**
 * Mounts `CartSync` (which renders nothing) lazily, so its code is not in the first-load JS that
 * every page ships: on the first idle moment (a timer where there is no idle callback), or on the
 * first press or key, whichever comes first. No SSR: it is a client-only effect. If the code fails
 * to load (offline), it stays armed and tries again on the next press, key, online or visibility
 * event. Nothing is lost by waiting: a sign-in event that fires before it mounts is covered,
 * because the mount runs the session check, and a tap made first is an ordinary guest change that
 * the sign-in merges.
 */
export function CartSyncLoader({ slugs }: { slugs: readonly string[] }) {
  const [Sync, setSync] = useState<ComponentType<{ slugs: readonly string[] }> | null>(null);
  useEffect(() => {
    const w = window;
    let loading = false;
    const load = () => {
      if (loading) return;
      loading = true;
      import("./cart-sync").then(
        (m) => {
          setSync(() => m.CartSync);
          off();
        },
        () => void (loading = false), // stay armed: the next event tries again
      );
    };
    const idle = typeof w.requestIdleCallback === "function";
    const id = idle ? w.requestIdleCallback(load, { timeout: 2000 }) : w.setTimeout(load, 2000);
    const events = ["pointerdown", "keydown", "online", "visibilitychange"];
    for (const e of events) w.addEventListener(e, load, true);
    function off() {
      if (idle) w.cancelIdleCallback(id);
      else w.clearTimeout(id);
      for (const e of events) w.removeEventListener(e, load, true);
    }
    return off;
  }, []);
  return Sync ? <Sync slugs={slugs} /> : null;
}
