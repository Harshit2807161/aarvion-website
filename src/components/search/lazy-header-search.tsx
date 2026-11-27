"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { flushSync } from "react-dom";
import type { HeaderSearchHandoff } from "./header-search";
import { StaticSearch } from "./static-search";

/** Idle loading starts this long after window load, so it never counts as first-load JS. */
export const IDLE_DELAY_MS = 2000;
const IDLE_TIMEOUT_MS = 2000;

type Loaded = {
  Search: ComponentType<{ chips: string[]; handoff?: HeaderSearchHandoff }>;
  handoff?: HeaderSearchHandoff;
};

/**
 * The header search without its code in the first-load JS. The server HTML is the plain input
 * (`StaticSearch`), so it is visible and typeable at once and `#q` works for the quick-action
 * cards. The combobox (`HeaderSearch`, with its hook, list and chips) is a separate chunk loaded on
 * the first focus or pointer down in the field, or, once the browser is idle (2 s after window load, so it is never first-load JS), then swapped in. The
 * swap carries over what the visitor typed, the caret and focus, so nothing is lost. If the chunk
 * fails to load the plain form keeps working (a GET to the medicines section).
 */
export function LazyHeaderSearch({ chips }: { chips: string[] }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const started = useRef(false);

  const load = useCallback(() => {
    if (started.current) return;
    started.current = true;
    import("./header-search")
      .then(({ HeaderSearch }) => {
        const input = document.getElementById("q") as HTMLInputElement | null;
        const handoff = input
          ? {
              value: input.value,
              start: input.selectionStart,
              end: input.selectionEnd,
              focused: document.activeElement === input,
            }
          : undefined;
        // Synchronously, so no keystroke can land in the plain field between reading it and the swap.
        flushSync(() => setLoaded({ Search: HeaderSearch, handoff }));
      })
      .catch(() => {
        started.current = false; // a later focus tries again
      });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    const schedule = () => {
      timer = setTimeout(() => {
        if (typeof window.requestIdleCallback === "function") {
          idle = window.requestIdleCallback(load, { timeout: IDLE_TIMEOUT_MS });
        } else load();
      }, IDLE_DELAY_MS);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
    };
  }, [load]);

  if (loaded) return <loaded.Search chips={chips} handoff={loaded.handoff} />;
  return <StaticSearch onActivate={load} />;
}
