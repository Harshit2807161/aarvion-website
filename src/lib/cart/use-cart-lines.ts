"use client";

import { useSyncExternalStore } from "react";
import type { CartLines } from "./cart";
import { cartStore } from "./store";

/** The cart lines, re-rendering on change. The server and the hydration render see `{}`. */
export function useCartLines(): CartLines {
  return useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot,
  );
}
