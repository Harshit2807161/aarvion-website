/**
 * The signed-in half of the cart store: the request queue, optimistic changes, the merge at
 * sign-in. It is loaded on demand (`import("./user-mode")` in store.ts) and never on a guest's
 * page load, because the first-load JS budget is a ratchet and only a signed-in shopper needs it.
 * It reads and drives the store through its public methods, and gets a `Host` for the few private
 * things it must change there; it holds no UI state.
 */
import type { CartView } from "@/server/cart/service";
import * as api from "./api";
import type { CartAction, CartLines } from "./cart";
import { cartStore, type CartIssue, type CartMode, type SignInResult } from "./store";

export type Host = {
  setLines(lines: CartLines): void;
  setMode(mode: CartMode): void;
  /** Sets the priced view (the server's), not stale. */
  setView(view: CartView): void;
  notify(): void;
  emit(issue: CartIssue): void;
  clearGuest(): void;
  /** Stops the guest quote timer and ignores any quote still in flight. */
  stopQuoting(): void;
  /** Starts recording changes made while a sign-in request is in flight; `endSignIn` returns them. */
  beginSignIn(): void;
  endSignIn(): CartAction[];
};

export type UserMode = {
  signIn(): Promise<SignInResult>;
  /** Sends a change that was already applied locally. */
  send(action: CartAction, next: number): void;
  /**
   * Reloads the server cart through the queue, so it never races a pending change. Quiet: a failed
   * reload says nothing and reverts no tap still on its way (only a 401 matters). One waiting
   * reload is enough, so visibility and focus together make one request.
   */
  refresh(): void;
  /** Forgets the queue (a 401 or a reset): replies from before it are ignored. */
  abandon(): void;
};

const toRecord = (lines: readonly { slug: string; qty: number }[]): CartLines => {
  const out: Record<string, number> = Object.create(null);
  for (const l of lines) out[l.slug] = l.qty;
  return out;
};

export function createUserMode(host: Host): UserMode {
  let serverLines: CartLines = toRecord([]); // the last lines the server confirmed
  let pending = 0; // requests queued or in flight, never below 0
  let epoch = 0; // bumped when the queue is abandoned: older replies are ignored
  let chain: Promise<void> = Promise.resolve();
  let refreshQueued = false; // a refresh is already waiting in the queue

  function adopt(v: CartView): void {
    serverLines = toRecord(v.lines.map((l) => ({ slug: l.slug, qty: l.qty })));
    host.setView(v);
  }

  /**
   * One request at a time, in order. Never rejects (the api functions never throw, and a listener
   * that throws must not wedge the queue for the rest of the page's life).
   */
  function enqueue(send: () => Promise<api.CartApiResult>, quiet = false): void {
    pending++;
    const mine = epoch;
    chain = chain
      .then(async () => {
        if (mine !== epoch) return; // the queue was abandoned (a 401): this change is moot
        const res = await send();
        if (mine !== epoch) return;
        pending = Math.max(0, pending - 1);
        settle(res, quiet);
      })
      .catch(() => {});
  }

  function settle(res: api.CartApiResult, quiet: boolean): void {
    if (res.ok) {
      adopt(res.view);
      if (pending === 0) host.setLines(serverLines); // an older reply must not undo a newer optimistic tap
      if (res.view.removed.length > 0) host.emit({ kind: "removed", slugs: res.view.removed });
      host.notify();
      return;
    }
    if (res.error === "unauthenticated") return cartStore.toGuest();
    if (quiet) return; // a failed background reload changes nothing and says nothing
    if (res.view) adopt(res.view);
    host.setLines(serverLines); // a refusal or a lost request puts the lines back as the server has them
    host.notify();
    if (res.error === "network" || res.error === "rate_limited") host.emit({ kind: "sync_failed" });
    else host.emit({ kind: "refused", error: res.error });
    // A request that timed out may still have been applied: look at the server's cart before any retry.
    if (res.error === "network") refresh();
  }

  function refresh(): void {
    if (refreshQueued) return;
    refreshQueued = true;
    enqueue(() => {
      refreshQueued = false;
      return api.getCart();
    }, true);
  }

  async function signIn(): Promise<SignInResult> {
    const none = { trimmed: false, removed: [] as string[] };
    const signedIn = cartStore.getMode() === "user";
    // Signed in already with changes on their way: their replies bring the server's lines.
    if (signedIn && pending > 0) return none;
    const guest = signedIn
      ? []
      : Object.entries(cartStore.getSnapshot()).map(([slug, qty]) => ({ slug, qty }));
    host.beginSignIn();
    const res = guest.length > 0 ? await api.mergeCart(guest) : await api.getCart();
    const replay = host.endSignIn();
    if (!res.ok) {
      if (res.error === "unauthenticated") {
        if (cartStore.getMode() === "user") cartStore.toGuest();
        return none; // signed out: asking again cannot help
      }
      host.emit({ kind: "sync_failed" });
      return { ...none, retry: true };
    }
    host.stopQuoting();
    adopt(res.view);
    host.setMode("user");
    host.setLines(serverLines);
    host.clearGuest(); // only now: a failed merge keeps the guest cart for the next try
    host.notify();
    for (const action of replay) {
      // A tap made while signing in is not lost; if the merged cart refuses it, say so.
      const blocked = cartStore.dispatch(action);
      if (blocked) host.emit({ kind: "refused", error: blocked });
    }
    const removed = res.view.removed;
    const trimmed = res.view.trimmed === true;
    if (removed.length > 0) host.emit({ kind: "removed", slugs: removed });
    if (trimmed) host.emit({ kind: "trimmed" });
    return { trimmed, removed };
  }

  return {
    signIn,
    refresh,
    send(action, next) {
      // A "+" is relative (`addItem`), so it lands on the server's quantity, not this tab's cached
      // one (another tab may have set 5). The rest are absolute: the API has no relative decrement.
      enqueue(() => {
        if (action.type === "inc") return api.addItem(action.slug, 1);
        if (action.type === "remove") return api.removeItem(action.slug);
        return api.setQty(action.slug, next);
      });
    },
    abandon() {
      epoch++;
      pending = 0;
      refreshQueued = false;
      serverLines = toRecord([]);
    },
  };
}
