"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/base/icon";
import { ROUTES } from "@/config/routes";
import { cartCount } from "@/lib/cart/cart";
import { cartStore, useCartLines } from "@/lib/cart/store";

/**
 * The header Cart pill, fed by the session cart. The link carries the full name ("Cart, 3 packs")
 * and the visible count is aria-hidden; changes are spoken by CartControl through the live region.
 * The count bumps (transform only; header.css drops it under reduced motion) when the cart
 * changes, but not for the stored cart that appears after hydration.
 */
export function CartPill() {
  const count = cartCount(useCartLines());
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      cartStore.subscribe(() => {
        const el = countRef.current;
        if (!el) return;
        el.classList.remove("bump");
        void el.offsetWidth; // restart the animation on rapid taps
        el.classList.add("bump");
      }),
    [],
  );

  return (
    <Link
      className="sh-btn sh-cart"
      href={ROUTES.cart}
      aria-label={`Cart, ${count} ${count === 1 ? "pack" : "packs"}`}
    >
      <Icon name="cart" />
      <span className="cart-label">Cart</span>
      <span
        ref={countRef}
        className="cart-count"
        aria-hidden="true"
        onAnimationEnd={(e) => e.currentTarget.classList.remove("bump")}
      >
        {count}
      </span>
    </Link>
  );
}
