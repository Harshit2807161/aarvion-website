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

/**
 * Keep only well-formed lines: integer quantities 1..perProduct, and no more than perOrder packs
 * in all (later lines are cut). Anything else is dropped. The result has no prototype, so a slug
 * such as "constructor" or "__proto__" is just a key.
 */
function sanitize(raw: unknown): CartLines {
  const out: Record<string, number> = Object.create(null);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  let total = 0;
  for (const [slug, n] of Object.entries(raw)) {
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) continue;
    const keep = Math.min(n, CART_LIMITS.perProduct, CART_LIMITS.perOrder - total);
    if (keep <= 0) break;
    out[slug] = keep;
    total += keep;
  }
  return out;
}

function read(): CartLines {
  try {
    const text = sessionStorage.getItem(CART_UI_STORAGE_KEY);
    return sanitize(text ? JSON.parse(text) : null);
  } catch {
    return sanitize(null); // storage blocked or the text is not JSON: start empty
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
  /** TEST ONLY: forget the cached lines so the next read goes back to sessionStorage. */
  reset(): void {
    cache = null;
  },
};
