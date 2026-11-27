"use client";

import Image from "next/image";
import { Icon } from "@/components/base/icon";
import { RxBadge } from "@/components/base/badge";
import { Rupees } from "@/components/base/rupees";
import { announce } from "@/components/feedback/live-region";
import { CART_LIMITS, cartCount } from "@/lib/cart/cart";
import { cartStore } from "@/lib/cart/store";
import { useCartLines } from "@/lib/cart/use-cart-lines";
import { fullComposition, packDisplay } from "@/lib/catalogue/display";
import type { PricedLine } from "@/server/cart/service";
import { sellingPricePaise } from "@/server/catalogue/pricing";
import { CART_COPY } from "./cart-copy";

/** The prototype's trash glyph (flows.js `icon("trash")`); drawn here so the shared icon set, which is first-load code, does not grow for a cart-only icon. */
export function TrashIcon() {
  return (
    <svg
      className="i"
      width={18}
      height={18}
      style={{ "--i-size": "18px" } as React.CSSProperties}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" />
    </svg>
  );
}

/**
 * One cart line, as the prototype's `lineEl` draws it. `line` is a priced line (see
 * `useCartView`): the price shown is the server's MRP for the pack, the selling price comes from
 * `sellingPricePaise`. `compact` is the drawer's line (the Remove text is dropped).
 *
 * The quantity is a plain `span`: `<output>` is an implicit live region, and changes are spoken
 * once, through `announce()`. At a limit the + stays focusable with `aria-disabled`, and a press
 * says why. Removing leaves focus to the list that owns the line.
 */
export function CartLineItem({
  line,
  variant,
  heading: Heading = "h3",
}: {
  line: PricedLine;
  variant: "full" | "compact";
  /** The name's heading level: the cart page sets what fits under its h1, the drawer what fits under its title. */
  heading?: "h2" | "h3" | "h4";
}) {
  const { slug, name, qty } = line;
  const lines = useCartLines();
  const productFull = qty >= CART_LIMITS.perProduct;
  const orderFull = cartCount(lines) >= CART_LIMITS.perOrder;
  const incDisabled = productFull || orderFull;
  const each = sellingPricePaise(line.mrpPaise);

  /** A relative change: signed in, "+" lands on the server's quantity, not this tab's cached one. */
  function step(type: "inc" | "dec") {
    const blocked = cartStore.dispatch({ type, slug });
    if (blocked) {
      announce(
        blocked === "product_limit" ? CART_COPY.productLimit(name) : CART_COPY.orderLimit,
      );
      return;
    }
    announce(CART_COPY.inCart(name, cartStore.getSnapshot()[slug] ?? 0));
  }

  function remove() {
    cartStore.dispatch({ type: "remove", slug });
    announce(CART_COPY.removed(name));
  }

  return (
    <li className="line" data-slug={slug}>
      <span className="well" aria-hidden="true">
        <Image
          src={line.image.src}
          alt=""
          width={line.image.width}
          height={line.image.height}
          sizes="88px"
        />
      </span>
      <div className="line-main">
        <Heading className="line-name">
          {name}
          {line.rxRequired && <RxBadge />}
        </Heading>
        <p className="line-salt">{fullComposition(line.composition)}</p>
        <p className="line-pack">{packDisplay(line)}</p>
      </div>
      <p className="line-price">
        <s className="mrp">
          <span className="sr-only">MRP </span>
          <Rupees paise={line.mrpPaise * qty} />
        </s>{" "}
        <b className="price mono">
          <span className="sr-only">, you pay </span>
          <Rupees paise={each * qty} />
        </b>
        {qty > 1 && (
          <span className="each mono">
            <Rupees paise={each} /> {CART_COPY.each}
          </span>
        )}
      </p>
      <div className="line-ctl">
        <div className="line-stepper" role="group" aria-label={CART_COPY.quantityOf(name)}>
          <button
            type="button"
            data-dec
            aria-label={CART_COPY.oneFewer(name)}
            aria-disabled={qty <= 1}
            onClick={() => qty > 1 && step("dec")}
          >
            <Icon name="minus" size={18} />
          </button>
          <span>{qty}</span>
          <button
            type="button"
            data-inc
            aria-label={CART_COPY.oneMore(name)}
            aria-disabled={incDisabled}
            onClick={() => step("inc")}
          >
            <Icon name="plus" size={18} />
          </button>
        </div>
        <button
          type="button"
          className="line-remove"
          data-remove
          aria-label={CART_COPY.removeFrom(name)}
          onClick={remove}
        >
          <TrashIcon />
          {variant === "full" && <span>{CART_COPY.remove}</span>}
        </button>
        <span className="line-max" hidden={!incDisabled}>
          {productFull ? CART_COPY.perProductMax : CART_COPY.perOrderMax}
        </span>
      </div>
    </li>
  );
}
