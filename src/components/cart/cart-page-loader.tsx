"use client";

import { lazy, Suspense, type ComponentProps } from "react";
import { CART_COPY } from "./cart-copy";
import type { CartPage as CartPageType } from "./cart-page";

/**
 * Loads the /cart body as its own chunk, behind a leaf Suspense with a static fallback. Imported
 * statically, the modules it shares with other routes (`Rupees`, the pricing and display helpers)
 * were hoisted into the chunk every page loads, growing first-load JS on / and /product/*.
 */
const CartPage = lazy(() => import("./cart-page").then((m) => ({ default: m.CartPage })));

/** The static fallback, and what the page shows before the cart is known. */
export function CartLoading() {
  return (
    <div className="cart-loading" aria-busy="true">
      <p>{CART_COPY.page.loading}</p>
    </div>
  );
}

export function CartPageLoader(props: ComponentProps<typeof CartPageType>) {
  return (
    <Suspense fallback={<CartLoading />}>
      <CartPage {...props} />
    </Suspense>
  );
}
