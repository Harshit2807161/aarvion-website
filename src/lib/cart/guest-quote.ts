/**
 * Prices the guest cart: after a quiet moment it asks `/api/cart/quote`, and a failed quote
 * retries with backoff. Loaded on demand (`import("./guest-quote")` in store.ts), because a
 * visitor with an empty cart never needs it and the first-load JS budget is a ratchet. `store.ts`
 * owns the view and its stale flag; this module only fetches.
 */
import type { CartView } from "@/server/cart/service";
import { quoteCart } from "./api";
import type { CartLines } from "./cart";

/** Guest changes re-quote after this much quiet. Longer than a tap burst, so one product's 1 to 10 is one request, not nine (the quote route allows 60 a minute per IP bucket). */
const QUOTE_DEBOUNCE_MS = 400;
/** After a failed quote (offline, rate limited) it tries again after each of these waits, then waits for the next change. */
const QUOTE_RETRY_MS = [1000, 3000, 8000];

export type QuoteHost = {
  /** The current generation: a reply for an older one is ignored. */
  generation(): number;
  lines(): CartLines;
  /** Takes a priced view (the store marks it current and drops lines the server says are retired). */
  accept(view: CartView): void;
  notify(): void;
};

export function createQuoter(host: QuoteHost) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  return {
    /** Prices the cart as it is now, for generation `mine`. */
    schedule(mine: number): void {
      clearTimeout(timer);
      retries = 0;
      const lines = Object.entries(host.lines()).map(([slug, qty]) => ({ slug, qty }));
      const run = async () => {
        const res = await quoteCart(lines);
        if (mine !== host.generation()) return; // a newer change superseded this request
        if (res.ok) host.accept(res.view);
        else if (retries < QUOTE_RETRY_MS.length)
          timer = setTimeout(run, QUOTE_RETRY_MS[retries++]);
        host.notify();
      };
      timer = setTimeout(run, QUOTE_DEBOUNCE_MS);
    },
    cancel(): void {
      clearTimeout(timer);
    },
  };
}
