"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/base/icon";
import { announce } from "@/components/feedback/live-region";
import { CART_LIMITS, cartCount, type CartBlock } from "@/lib/cart/cart";
import { cartStore } from "@/lib/cart/store";
import { useCartLines } from "@/lib/cart/use-cart-lines";

function blockedMessage(blocked: CartBlock, name: string): string {
  return blocked === "product_limit"
    ? `You can order up to ${CART_LIMITS.perProduct} packs of ${name}.`
    : `An order can hold up to ${CART_LIMITS.perOrder} packs.`;
}

/**
 * Add to cart, which becomes a stepper once the pack is in the cart. Both are always rendered and
 * CSS (cart-control.css) shows one by `data-qty`, as in the v2 prototype. The server and the first
 * hydration render see an empty cart, so the stored quantity appears right after hydration.
 *
 * At a limit the + stays focusable with `aria-disabled` and a click explains the limit through the
 * live region, rather than going silently dead.
 */
export function CartControl({ slug, name }: { slug: string; name: string }) {
  const lines = useCartLines();
  const qty = lines[slug] ?? 0;
  const full = qty >= CART_LIMITS.perProduct || cartCount(lines) >= CART_LIMITS.perOrder;
  const addRef = useRef<HTMLButtonElement>(null);
  const incRef = useRef<HTMLButtonElement>(null);
  // Focus can only move once the target is displayed, i.e. after the render for the new qty.
  const focusNext = useRef<"inc" | "add" | null>(null);

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "inc" && qty > 0) incRef.current?.focus();
    if (target === "add" && qty === 0) addRef.current?.focus();
  }, [qty]);

  function step(type: "inc" | "dec") {
    const before = qty;
    const blocked = cartStore.dispatch({ type, slug });
    if (blocked) return announce(blockedMessage(blocked, name));
    const after = cartStore.getSnapshot()[slug] ?? 0;
    if (after === before) return;
    if (before === 0) focusNext.current = "inc";
    if (after === 0) focusNext.current = "add";
    announce(after === 0 ? `${name} removed from cart` : `${name}: ${after} in cart`);
  }

  return (
    <div className="cart-ctl" data-qty={qty}>
      <button
        ref={addRef}
        className="btn-add"
        type="button"
        data-add
        aria-label={`Add ${name} to cart`}
        aria-disabled={full || undefined}
        onClick={() => step("inc")}
      >
        <Icon name="plus" size={18} />
        <span>Add to cart</span>
      </button>
      <div className="stepper" role="group" aria-label={`${name} in cart`}>
        <button
          type="button"
          data-dec
          aria-label={`Remove one ${name}`}
          onClick={() => step("dec")}
        >
          <Icon name="minus" />
        </button>
        <output>{qty}</output>
        <button
          ref={incRef}
          type="button"
          data-inc
          aria-label={`Add one more ${name}`}
          aria-disabled={full || undefined}
          onClick={() => step("inc")}
        >
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}
