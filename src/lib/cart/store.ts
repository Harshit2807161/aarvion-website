"use client";

import { useSyncExternalStore } from "react";
import {
  CART_LIMITS,
  CART_UI_STORAGE_KEY,
  applyCart,
  type CartAction,
  type CartBlock,
  type CartLines,
} from "./cart";

/** What the server (and the first hydration render) sees: an empty cart. Frozen and shared. */
const SERVER_LINES: CartLines = Object.freeze({});

/** Keep only well-formed lines: integer quantities 1..perProduct. Anything else is dropped. */
function sanitize(raw: unknown): CartLines {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [slug, n] of Object.entries(raw)) {
    if (typeof n === "number" && Number.isInteger(n) && n > 0) {
      out[slug] = Math.min(n, CART_LIMITS.perProduct);
    }
  }
  return out;
}

function read(): CartLines {
  try {
    const text = sessionStorage.getItem(CART_UI_STORAGE_KEY);
    return text ? sanitize(JSON.parse(text)) : {};
  } catch {
    return {}; // storage blocked or the text is not JSON: start empty
  }
}

function write(lines: CartLines): void {
  try {
    sessionStorage.setItem(CART_UI_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Blocked or full: the cart still works for this page view, it just will not survive a reload.
  }
}

// `cache` is what makes getSnapshot safe for useSyncExternalStore: sessionStorage is parsed once
// and the object is replaced only by a dispatch that changed something, so React never sees a
// new object for an unchanged store (which would loop).
let cache: CartLines | null = null;
const listeners = new Set<() => void>();

export const cartStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  getSnapshot(): CartLines {
    return (cache ??= read());
  },
  getServerSnapshot(): CartLines {
    return SERVER_LINES;
  },
  /** Apply an action; returns why it was refused, or null. Subscribers hear only real changes. */
  dispatch(action: CartAction): CartBlock | null {
    const current = cartStore.getSnapshot();
    const { lines, blocked } = applyCart(current, action);
    if (lines !== current) {
      cache = lines;
      write(lines);
      listeners.forEach((l) => l());
    }
    return blocked;
  },
  /** Forget the cached lines so the next read goes back to sessionStorage. For tests. */
  reset(): void {
    cache = null;
  },
};

export function useCartLines(): CartLines {
  return useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot,
  );
}
