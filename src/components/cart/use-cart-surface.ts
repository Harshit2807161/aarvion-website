"use client";

import {
  type MouseEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { fetchSessionState } from "@/components/auth/session-state";
import { cartStore, type CartMode } from "@/lib/cart/store";

/**
 * Hooks shared by the cart surfaces (the /cart page and the drawer). Lazy with them: never
 * first-load code.
 */

const getServerMode = (): CartMode => "unknown";
const noSubscribe = () => () => {};

/**
 * Whether the cart may still be loading, and whether someone is signed in. On mount it prices a
 * stored guest cart at once (`cartStore.price()`) and, while the store's mode is unknown, asks the
 * session itself (one request) and signs the store in on `in` (the store shares one sign-in with
 * `CartSync`; a failed one falls back to the guest cart).
 *
 * `loading` is true on the server render, and with no lines (never seen any) while that check is
 * pending or a confirmed signed-in cart loads, so a signed-in cart never shows as empty (P3-M1)
 * and the wait is bounded (P4-M1: once lines were seen, an empty store is an empty cart).
 */
export function useCartSession(count: number): {
  mode: CartMode;
  signedIn: boolean;
  loading: boolean;
} {
  const mode = useSyncExternalStore(cartStore.subscribe, cartStore.getMode, getServerMode);
  // The server render (and the hydration pass) cannot know the cart: it shows the loading state.
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const [sessionIn, setSessionIn] = useState(false);
  const [signingIn, setSigningIn] = useState(false); // a confirmed signed-in cart is loading
  // The surface's own session check is pending (one request, never stuck on CartSync). Until it
  // answers, an empty store may still be a signed-in cart, so the empty state waits for it.
  const [checking, setChecking] = useState(() => cartStore.getMode() === "unknown");

  useEffect(() => {
    cartStore.price();
    if (cartStore.getMode() !== "unknown") return; // known already: `checking` no longer matters
    let alive = true;
    void fetchSessionState().then((session) => {
      if (!alive) return;
      setChecking(false);
      if (session.state !== "in") return; // out or unknown: the guest cart stands
      setSessionIn(true);
      if (cartStore.getMode() === "user") return;
      setSigningIn(true);
      void cartStore.signIn().finally(() => alive && setSigningIn(false));
    });
    return () => {
      alive = false;
    };
  }, []);

  const [seen, setSeen] = useState(false);
  if (count > 0 && !seen) setSeen(true);
  const loading =
    !hydrated ||
    (count === 0 && !seen && ((checking && mode === "unknown") || (signingIn && mode !== "user")));
  return { mode, signedIn: mode === "user" || sessionIn, loading };
}

/**
 * Focus after Remove: put the returned handler on the lines' container as `onClickCapture`. It
 * remembers where the removed line (`li[data-slug]` holding a `[data-remove]`) was; once the line
 * is gone from `order`, focus goes to the next line's Remove, else the previous line's, else
 * `empty` (the empty state's link).
 */
export function useRemoveFocus(
  order: string[],
  container: RefObject<HTMLElement | null>,
  empty: RefObject<HTMLElement | null>,
): (e: MouseEvent<HTMLElement>) => void {
  const removed = useRef<{ slug: string; index: number } | null>(null);
  const orderKey = order.join("\n");
  useEffect(() => {
    const r = removed.current;
    if (!r) return;
    const now = orderKey ? orderKey.split("\n") : [];
    if (now.includes(r.slug)) return;
    removed.current = null;
    const target = now[r.index] ?? now[r.index - 1];
    if (!target) return empty.current?.focus();
    const li = [...(container.current?.querySelectorAll("li[data-slug]") ?? [])].find(
      (el) => el.getAttribute("data-slug") === target,
    );
    li?.querySelector<HTMLElement>("[data-remove]")?.focus();
  }, [orderKey, container, empty]);

  return (e) => {
    const li = (e.target as Element).closest("[data-remove]")?.closest("li[data-slug]");
    const slug = li?.getAttribute("data-slug");
    if (slug) removed.current = { slug, index: order.indexOf(slug) };
  };
}
