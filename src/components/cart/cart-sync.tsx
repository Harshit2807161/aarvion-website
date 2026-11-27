"use client";

import { useEffect, useRef } from "react";
import { fetchSessionState } from "@/components/auth/session-state";
import { SIGNED_IN_EVENT } from "@/components/auth/events";
import { announce } from "@/components/feedback/live-region";
import { cartStore, type CartIssue } from "@/lib/cart/store";
import { CART_LIMITS } from "@/lib/cart/cart";

/** What the shopper hears (awaiting owner approval, like every new customer string). Lazy with this module. */
const COPY = {
  removed: "A medicine in your cart is no longer available, so it was removed.",
  trimmed: "Your cart was full, so some packs weren’t added.",
  syncFailed: "We couldn’t update your cart. Check your connection and try again.",
  notFound: "That medicine isn’t available right now.",
  productLimit: `You can order up to ${CART_LIMITS.perProduct} packs of one medicine.`,
  orderLimit: `An order can hold up to ${CART_LIMITS.perOrder} packs.`,
} as const;

function sentence(issue: CartIssue): string {
  switch (issue.kind) {
    case "removed":
      return COPY.removed;
    case "trimmed":
      return COPY.trimmed;
    case "sync_failed":
      return COPY.syncFailed;
    case "refused":
      if (issue.error === "product_limit") return COPY.productLimit;
      return issue.error === "order_limit" ? COPY.orderLimit : COPY.notFound;
  }
}

/**
 * Drops guest lines for products the catalogue no longer has, so they never count toward the cap.
 * An empty set means the catalogue is not loaded, not that every product is gone. Returns whether
 * anything was dropped.
 */
function dropUnsold(known: ReadonlySet<string>): boolean {
  if (known.size === 0 || cartStore.getMode() === "user") return false;
  const gone = Object.keys(cartStore.getSnapshot()).filter((slug) => !known.has(slug));
  for (const slug of gone) cartStore.dispatch({ type: "remove", slug });
  return gone.length > 0;
}

/**
 * Renders nothing. Keeps the cart store in step with the session. On mount it asks who is signed
 * in: a signed-in shopper signs the store in (guest lines are merged into the server cart); a
 * confirmed "nobody" leaves the guest cart and drops lines for products the catalogue no longer
 * has; "could not find out" changes nothing, so a flaky connection never hides a signed-in
 * shopper's cart. It signs in again on `SIGNED_IN_EVENT`, which both the login dialog and the
 * /login page fire (the layout stays mounted across the page's soft navigation). Issues the store
 * reports are spoken through the page's one live region; ones reported in the same moment (a
 * merge that dropped a line and trimmed the cart) go out as one message, since a newer
 * `announce()` replaces one still waiting. When the tab becomes visible again (or the window gains
 * focus or the network returns) a signed-in cart is reloaded, so another tab's change shows up, and a
 * session check that could not find out is asked once more, as is a sign-in that failed to load its
 * code, while a 401 stops the retries and the failure is announced once per visit. Mounted lazily by `CartSyncLoader`. `slugs` come from the cached catalogue.
 */
export function CartSync({ slugs }: { slugs: readonly string[] }) {
  const known = useRef(slugs);
  useEffect(() => {
    known.current = slugs;
  });

  useEffect(() => {
    let alive = true;
    let spoken: string[] = [];
    let retryUnknown = false;
    let retrySignIn = false;
    const say = (text: string) => {
      if (spoken.length === 0) {
        void Promise.resolve().then(() => {
          const message = [...new Set(spoken)].join(" ");
          spoken = [];
          if (alive && message) announce(message);
        });
      }
      spoken.push(text);
    };
    let saidSignInFailure = false;
    const offIssue = cartStore.onIssue((issue) => {
      // A failed sign-in that is retried on every wake-up says so once per visit, not every time.
      if (issue.kind === "sync_failed" && issue.signIn) {
        if (saidSignInFailure) return;
        saidSignInFailure = true;
      }
      say(sentence(issue));
    });

    cartStore.forgetLegacy();
    const signIn = () => {
      void cartStore.signIn().then((r) => {
        // The code or the network failed: try once more when the tab wakes up or the network returns.
        // A 401 (signed out) is not retried.
        if (alive && r.retry) retrySignIn = true;
      });
    };
    const check = () =>
      void fetchSessionState().then((session) => {
        if (!alive) return;
        if (session.state === "in") return signIn();
        if (session.state === "unknown") {
          retryUnknown = true; // ask once more the next time the tab wakes up or the network returns
          return;
        }
        retryUnknown = false;
        cartStore.toGuest(true); // a no-op if a sign-in finished while this answer was on its way
        if (dropUnsold(new Set(known.current))) say(COPY.removed);
      });
    check();
    const onSignedIn = signIn;
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      if (retrySignIn) {
        retrySignIn = false;
        signIn();
      } else if (retryUnknown) {
        retryUnknown = false;
        check();
      } else cartStore.refresh(); // another tab may have changed the server cart
    };
    window.addEventListener(SIGNED_IN_EVENT, onSignedIn);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      alive = false;
      offIssue();
      window.removeEventListener(SIGNED_IN_EVENT, onSignedIn);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, []);
  return null;
}
