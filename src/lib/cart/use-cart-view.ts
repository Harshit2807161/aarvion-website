"use client";

import { useSyncExternalStore } from "react";
import type { CartTotals, PricedLine } from "@/server/cart/service";
import { cartTotals } from "@/server/catalogue/pricing";
import type { CartLines } from "./cart";
import { cartStore } from "./store";

export type CartViewState = {
  /** The lines that have a price, in cart order, at their current quantity. */
  lines: PricedLine[];
  /** Over `lines` only, so a pending slug is never in it. */
  totals: CartTotals;
  /** Slugs in the cart that no priced view has described yet (not in `lines`, not in `totals`). */
  pending: string[];
  /** The totals may not match the cart: a quote is pending or failed, or a line is pending. Say so; never show them as current. */
  updating: boolean;
};

/** What the server and the first hydration render see: an empty cart. Frozen and shared. */
const SERVER_VIEW: CartViewState = Object.freeze({
  lines: [],
  totals: cartTotals([]),
  pending: [],
  updating: false,
});

let last: { lines: CartLines; view: unknown; stale: boolean; state: CartViewState } | null = null;

/** Joins the quantities in the store with the facts of the last priced view. Memoised on its inputs, so an unchanged store gives React the same object (no render loop). */
function snapshot(): CartViewState {
  const lines = cartStore.getSnapshot();
  const view = cartStore.getView();
  const stale = cartStore.isViewStale();
  if (last && last.lines === lines && last.view === view && last.stale === stale) {
    return last.state;
  }
  // The view prices the lines as they were when it was quoted, so it holds every slug that was
  // in the cart then; one added since is pending until the next view arrives.
  const facts = new Map((view?.lines ?? []).map((l) => [l.slug, l]));
  const priced: PricedLine[] = [];
  const pending: string[] = [];
  for (const [slug, qty] of Object.entries(lines)) {
    const fact = facts.get(slug);
    if (fact) priced.push({ ...fact, qty });
    else pending.push(slug);
  }
  const state: CartViewState = {
    lines: priced,
    totals: cartTotals(priced),
    pending,
    updating: stale || pending.length > 0,
  };
  last = { lines, view, stale, state };
  return state;
}

/**
 * The cart for the cart page and drawer: the quantities in the store joined with the prices of
 * the last server-priced view (`cartStore.getView()`). Nothing here is priced on the client; the
 * totals add up the server's MRPs over the current quantities with `cartTotals`.
 */
export function useCartView(): CartViewState {
  return useSyncExternalStore(cartStore.subscribe, snapshot, () => SERVER_VIEW);
}
