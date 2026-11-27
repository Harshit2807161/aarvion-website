import { capLines, type CartLine } from "@/server/cart/rules";
import type { CartView } from "@/server/cart/service";
import type { createQuoter } from "./guest-quote";
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
let quoteSeq = 0; // bumped on every cart change: a quote reply for an older generation is ignored
let quoter: ReturnType<typeof createQuoter> | null = null; // loaded on demand, see guest-quote.ts
let loadingQuoter: Promise<ReturnType<typeof createQuoter>> | null = null;
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

/** Loads the quoting half once. A failed load (offline) is retried by the next change. */
function loadQuoter(): Promise<ReturnType<typeof createQuoter>> {
  return (loadingQuoter ??= import("./guest-quote").then(
    (m) =>
      (quoter = m.createQuoter({
        generation: () => quoteSeq,
        lines: () => cartStore.getSnapshot(),
        accept(v) {
          view = v;
          viewStale = false;
          if (v.removed.length > 0) dropRetired(v.removed);
        },
        notify,
      })),
    (err) => {
      loadingQuoter = null;
      throw err;
    },
  ));
}

/**
 * Price the current lines after a quiet moment (`guest-quote.ts`). Nothing is written server side.
 * A failed quote keeps the last good view, marks it stale and retries with backoff, so a rate limit
 * or a bad connection never leaves totals that look current but are not. Every cart change
 * supersedes any quote in flight, whether or not it sends another one: a reply for older lines
 * must never clear `stale` or replace the view of newer ones. An empty cart needs no quote, and
 * the quoting code is not even loaded for it.
 */
function scheduleQuote(): void {
  const mine = ++quoteSeq;
  quoter?.cancel();
  if (Object.keys(cartStore.getSnapshot()).length === 0) {
    view = null;
    viewStale = false;
    return;
  }
  viewStale = true;
  loadQuoter()
    .then((q) => mine === quoteSeq && q.schedule(mine))
    .catch(() => {});
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
    quoter?.cancel();
    quoter = null;
    loadingQuoter = null;
    cache = null;
    view = null;
    viewStale = false;
    quoteSeq++;
    listeners.clear();
    issueListeners.clear();
  },
};
