"use client";

import { useEffect } from "react";
import { cartStore } from "@/lib/cart/store";

/**
 * Renders nothing. Once mounted it drops stored cart lines for slugs the catalogue no longer
 * has, so a stale sessionStorage cart cannot fill the 20-pack cap with products nobody can buy.
 * `slugs` come from the cached catalogue in the (store) layout.
 */
export function CartReconcile({ slugs }: { slugs: readonly string[] }) {
  useEffect(() => {
    cartStore.reconcile(new Set(slugs));
  }, [slugs]);
  return null;
}
