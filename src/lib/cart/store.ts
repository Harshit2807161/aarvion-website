import { capLines, type CartLine } from "@/server/cart/rules";
import type { CartView } from "@/server/cart/service";
import * as api from "./api";
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
/** Guest changes re-quote after this much quiet. Longer than a tap burst, so one product's 1 to 10 is one request, not nine (the quote route allows 60 a minute per IP bucket). */
const QUOTE_DEBOUNCE_MS = 400;
/** After a failed quote (offline, rate limited) it tries again after each of these waits, then waits for the next change. */
const QUOTE_RETRY_MS = [1000, 3000, 8000];

/** Something the shopper should be told; `CartSync` speaks it through the page's live region. */
export type CartIssue =
  | { kind: "removed"; slugs: string[] }
  | { kind: "refused"; error: CartBlock | "product_not_found" }
  | { kind: "sync_failed" }
  | { kind: "trimmed" };

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
let view: CartView | null = null;
let viewStale = false; // the view prices an older set of lines than the snapshot holds
let quoteTimer: ReturnType<typeof setTimeout> | undefined;
let quoteSeq = 0;
let retries = 0;
const listeners = new Set<() => void>();
const issueListeners = new Set<(issue: CartIssue) => void>();
const notify = () => listeners.forEach((l) => l());
const emit = (issue: CartIssue) => issueListeners.forEach((l) => l(issue));

/** Drops lines the server says can no longer be bought, and tells the shopper once. */
function dropRetired(slugs: readonly string[]): void {
  const gone = new Set(slugs);
  const kept = Object.entries(cartStore.getSnapshot()).filter(([slug]) => !gone.has(slug));
  cache = Object.assign(Object.create(null), Object.fromEntries(kept));
  writeGuest(cache!);
  emit({ kind: "removed", slugs: [...gone] });
}

/**
 * Price the current lines after a quiet moment. Nothing is written server side. A failed quote
 * keeps the last good view, marks it stale and retries with backoff, so a rate limit or a bad
 * connection never leaves totals that look current but are not.
 */
function scheduleQuote(): void {
  clearTimeout(quoteTimer);
  retries = 0;
  // Every cart change supersedes any quote in flight, whether or not it sends another one: a reply
  // for older lines must never clear `stale` or replace the view of newer ones.
  const mine = ++quoteSeq;
  const lines = cartStore.getSnapshot();
  if (Object.keys(lines).length === 0) {
    view = null;
    viewStale = false;
    return;
  }
  viewStale = true;
  const run = async () => {
    const res = await api.quoteCart(toArray(lines));
    if (mine !== quoteSeq) return; // a newer change superseded this request
    if (res.ok) {
      view = res.view;
      viewStale = false;
      if (res.view.removed.length > 0) dropRetired(res.view.removed);
    } else if (retries < QUOTE_RETRY_MS.length) {
      quoteTimer = setTimeout(run, QUOTE_RETRY_MS[retries++]);
    }
    notify();
  };
  quoteTimer = setTimeout(run, QUOTE_DEBOUNCE_MS);
}

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
  /** The last priced view (a quote of the guest lines), or null before one exists. Check `isViewStale()` before showing totals as current. */
  getView(): CartView | null {
    return view;
  },
  /** True while the view prices an older set of lines (a quote is pending or failed): the UI may say totals are updating. */
  isViewStale(): boolean {
    return viewStale;
  },
  onIssue(listener: (issue: CartIssue) => void): () => void {
    issueListeners.add(listener);
    return () => void issueListeners.delete(listener);
  },
  /** Apply an action; returns why it was refused, or null. Written to sessionStorage and re-quoted; subscribers hear only real changes. */
  dispatch(action: CartAction): CartBlock | null {
    const current = cartStore.getSnapshot();
    const { lines, blocked } = applyCart(current, action);
    if (lines === current) return blocked;
    cache = lines;
    writeGuest(lines);
    scheduleQuote();
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
    scheduleQuote();
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
    clearTimeout(quoteTimer);
    cache = null;
    view = null;
    viewStale = false;
    retries = 0;
    quoteSeq++;
    listeners.clear();
    issueListeners.clear();
  },
};
