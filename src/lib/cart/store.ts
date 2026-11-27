import { capLines, type CartLine } from "@/server/cart/rules";
import {
  CART_GUEST_STORAGE_KEY,
  CART_UI_STORAGE_KEY,
  applyCart,
  type CartAction,
  type CartBlock,
  type CartLines,
} from "./cart";

/** What the server (and the first hydration render) sees: an empty cart. Frozen and shared. */
const SERVER_LINES: CartLines = Object.freeze({});

/** The lines as a prototype-less record, so a slug like "constructor" or "__proto__" is just a key. */
function toRecord(lines: readonly CartLine[]): CartLines {
  const out: Record<string, number> = Object.create(null);
  for (const l of lines) out[l.slug] = l.qty;
  return out;
}
const toArray = (lines: CartLines): CartLine[] =>
  Object.entries(lines).map(([slug, qty]) => ({ slug, qty }));

/** The guest cart from sessionStorage, re-capped with the shared rules. Reading never writes. */
function readGuest(): CartLines {
  try {
    const text = sessionStorage.getItem(CART_GUEST_STORAGE_KEY);
    const raw: unknown = text ? JSON.parse(text) : null;
    const lines = raw && typeof raw === "object" ? (raw as { lines?: unknown }).lines : null;
    return toRecord(capLines(Array.isArray(lines) ? lines : []).lines);
  } catch {
    return toRecord([]); // storage blocked or the text is not JSON: start empty
  }
}

function writeGuest(lines: CartLines): void {
  try {
    sessionStorage.setItem(CART_GUEST_STORAGE_KEY, JSON.stringify({ lines: toArray(lines) }));
    sessionStorage.removeItem(CART_UI_STORAGE_KEY);
  } catch {
    // Blocked or full: the cart still works for this page view, it just will not survive a reload.
  }
}

// `cache` is what makes getSnapshot safe for useSyncExternalStore: the lines object is replaced
// only by a change, so React never sees a new object for an unchanged store (which would loop).
let cache: CartLines | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const cartStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  getSnapshot(): CartLines {
    return (cache ??= readGuest());
  },
  getServerSnapshot(): CartLines {
    return SERVER_LINES;
  },
  /** Apply an action; returns why it was refused, or null. Written to sessionStorage; subscribers hear only real changes. */
  dispatch(action: CartAction): CartBlock | null {
    const current = cartStore.getSnapshot();
    const { lines, blocked } = applyCart(current, action);
    if (lines === current) return blocked;
    cache = lines;
    writeGuest(lines);
    notify();
    return blocked;
  },
  /**
   * Drop lines whose slug is not in the catalogue (a product retired since the cart
   * was saved), so they never count toward the cap. Returns whether anything was dropped.
   */
  reconcile(known: ReadonlySet<string>): boolean {
    // An empty set means the catalogue is not loaded, not that every product is gone.
    if (known.size === 0) return false;
    const current = cartStore.getSnapshot();
    const kept = Object.entries(current).filter(([slug]) => known.has(slug));
    if (kept.length === Object.keys(current).length) return false;
    cache = Object.assign(Object.create(null), Object.fromEntries(kept));
    writeGuest(cache!);
    notify();
    return true;
  },
  /** Drops the old `aarv-cart-ui-v0` key, which is never migrated (pre-launch). Run once on load. */
  forgetLegacy(): void {
    try {
      sessionStorage.removeItem(CART_UI_STORAGE_KEY);
    } catch {
      // Nothing to forget.
    }
  },
  /** TEST ONLY: forget every cached value so the next read goes back to sessionStorage. */
  reset(): void {
    cache = null;
    listeners.clear();
  },
};
