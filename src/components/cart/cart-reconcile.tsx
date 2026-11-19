"use client";

import { useEffect } from "react";
import { announce } from "@/components/feedback/live-region";
import { cartStore } from "@/lib/cart/store";

/**
 * Renders nothing. Once mounted it drops stored cart lines for slugs the catalogue no longer
 * has, so a stale sessionStorage cart cannot fill the 20-pack cap with products nobody can buy.
 * `slugs` come from the cached catalogue in the (store) layout.
 */
export function CartReconcile({ slugs }: { slugs: readonly string[] }) {
  useEffect(() => {
    if (cartStore.reconcile(new Set(slugs))) {
      announce("A medicine in your cart is no longer available, so it was removed.");
    }
  }, [slugs]);
  return null;
}
