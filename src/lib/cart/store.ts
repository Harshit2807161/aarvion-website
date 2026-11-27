import { capLines, type CartLine } from "@/server/cart/rules";
import type { CartView } from "@/server/cart/service";
import type { createQuoter } from "./guest-quote";
import type { Host, UserMode } from "./user-mode";
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
export type CartMode = "unknown" | "guest" | "user";

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

function clearGuest(): void {
  try {
    sessionStorage.removeItem(CART_GUEST_STORAGE_KEY);
    sessionStorage.removeItem(CART_UI_STORAGE_KEY);
  } catch {
    // Nothing to clear.
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
let mode: CartMode = "unknown";
let user: UserMode | null = null; // the signed-in half, loaded on demand (user-mode.ts)
let loadingUser: Promise<UserMode> | null = null;
let signInPromise: Promise<{ trimmed: boolean; removed: string[] }> | null = null;
let signingIn = false;
let duringSignIn: CartAction[] = []; // changes made while a sign-in request is in flight, re-applied after it
const listeners = new Set<() => void>();
const issueListeners = new Set<(issue: CartIssue) => void>();
const notify = () => listeners.forEach((l) => l());
const emit = (issue: CartIssue) => issueListeners.forEach((l) => l(issue));

/** Keeps only the guest lines whose slug passes `keep`; returns whether any line was dropped. */
function keepOnly(keep: (slug: string) => boolean): boolean {
  const current = cartStore.getSnapshot();
  const kept = Object.entries(current).filter(([slug]) => keep(slug));
  if (kept.length === Object.keys(current).length) return false;
  cache = Object.assign(Object.create(null), Object.fromEntries(kept));
  writeGuest(cache!);
  return true;
}

/** Drops lines the server says can no longer be bought, and tells the shopper once. */
function dropRetired(slugs: readonly string[]): void {
  const gone = new Set(slugs);
  keepOnly((slug) => !gone.has(slug));
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
    .then((q) => q.schedule(mine))
    // The chunk did not arrive (offline): try again once when the network returns, not on the next tap.
    .catch(() => globalThis.addEventListener?.("online", scheduleQuote, { once: true }));
}

/** What the lazily loaded user mode may change here. */
const host: Host = {
  setLines(lines) {
    cache = lines;
  },
  setMode(m) {
    mode = m;
  },
  setView(v) {
    view = v;
    viewStale = false;
  },
  notify,
  emit,
  clearGuest,
  stopQuoting() {
    quoter?.cancel();
    quoteSeq++;
  },
  beginSignIn() {
    signingIn = true;
    duringSignIn = [];
  },
  endSignIn() {
    signingIn = false;
    const taps = duringSignIn;
    duringSignIn = [];
    return taps;
  },
};

/** Loads the signed-in half once. A failed load (offline) is retried by the next call. */
function loadUser(): Promise<UserMode> {
  return (loadingUser ??= import("./user-mode").then(
    (m) => (user = m.createUserMode(host)),
    (err) => {
      loadingUser = null;
      throw err;
    },
  ));
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
  getMode(): CartMode {
    return mode;
  },
  /** The last priced view (the server's when signed in, else a quote of the guest lines), or null before one exists. Check `isViewStale()` before showing totals as current. */
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
    if (mode === "user" && user) {
      user.send(action, lines[action.slug] ?? 0);
    } else {
      if (signingIn) duringSignIn.push(action);
      writeGuest(lines);
      scheduleQuote();
    }
    notify();
    return blocked;
  },
  /**
   * Drop lines whose slug is not in the catalogue (a product retired since the cart
   * was saved), so they never count toward the cap. Returns whether anything was dropped.
   */
  reconcile(known: ReadonlySet<string>): boolean {
    // An empty set means the catalogue is not loaded, not that every product is gone.
    if (known.size === 0 || mode === "user") return false;
    if (!keepOnly((slug) => known.has(slug))) return false;
    scheduleQuote();
    notify();
    return true;
  },
  /**
   * Signed in: folds the guest lines into the server cart (else just loads it), then clears guest
   * storage and switches to user mode. A second call while one runs shares its promise, so a mount
   * and a sign-in event cannot merge twice. A change made while it runs is re-applied afterwards.
   * Resolves with what the shopper should be told (it also emits `removed` and `trimmed` issues).
   */
  signIn(): Promise<{ trimmed: boolean; removed: string[] }> {
    // The chunk loads here, when someone is (or may be) signed in. A tap made while it loads is an
    // ordinary guest change: the merge below starts from the cart as it is when the chunk is ready.
    return (signInPromise ??= loadUser()
      .then((u) => u.signIn())
      .catch(() => {
        emit({ kind: "sync_failed" });
        return { trimmed: false, removed: [] as string[] };
      })
      .finally(() => {
        signInPromise = null;
      }));
  },
  /**
   * Guest mode. With no argument this is the signed-out fall-back (a 401 on a user request): the
   * cart empties and the server cart waits for the next sign-in. `keepLines` is for a page load
   * that finds nobody signed in: the guest cart stays, and a store that is already signed in is
   * left alone (a stale answer must not undo a sign-in).
   */
  toGuest(keepLines = false): void {
    if (keepLines && mode === "user") return;
    mode = "guest";
    user?.abandon();
    cache = keepLines ? (cache ?? readGuest()) : toRecord([]);
    if (!keepLines) writeGuest(cache);
    view = null;
    viewStale = false;
    scheduleQuote();
    notify();
  },
  /** Signed in: reloads the server cart (quietly) so a change made in another tab shows up. */
  refresh(): void {
    if (mode === "user") user?.refresh();
  },
  /** Drops the old `aarv-cart-ui-v0` key, which is never migrated (pre-launch). Run once on load. */
  forgetLegacy(): void {
    try {
      sessionStorage.removeItem(CART_UI_STORAGE_KEY);
    } catch {
      // Nothing to forget.
    }
  },
};

/** TEST ONLY: forgets every cached value so the next read goes back to sessionStorage. It is a standalone export, not a store method, so the production build drops it. */
export function resetCartStore(): void {
  quoter?.cancel();
  quoter = null;
  loadingQuoter = null;
  cache = null;
  view = null;
  viewStale = false;
  quoteSeq++;
  mode = "unknown";
  user?.abandon();
  user = null;
  loadingUser = null;
  signInPromise = null;
  signingIn = false;
  duringSignIn = [];
  listeners.clear();
  issueListeners.clear();
}
