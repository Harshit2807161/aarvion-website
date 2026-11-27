"use client";

import type { MouseEvent, ReactNode, Ref } from "react";
import { RxBadge } from "@/components/base/badge";
import { Icon } from "@/components/base/icon";
import { openLogin } from "@/components/auth/account-pill";
import { announce } from "@/components/feedback/live-region";
import { ROUTES } from "@/config/routes";
import { cartStore } from "@/lib/cart/store";
import { CART_COPY } from "./cart-copy";
import { TrashIcon } from "./cart-line";

/** The pieces of the /cart page (`CartPage` composes them). Lazy with the page: never first-load code. */

const P = CART_COPY.page;

/** What the cached catalogue says about a product: a name and the Rx flag, never a price. */
export type KnownProduct = { name: string; rx: boolean };

/** One row of a group: a priced `CartLineItem` or a `PendingLine`. */
export type Row = { slug: string; rx: boolean; node: ReactNode };

const guestCheckout = `${ROUTES.login}?next=${encodeURIComponent(ROUTES.checkout)}`;

/** A line the server has not priced yet: the name if the catalogue knows it, the quantity and a working Remove, so packs that count toward the cap can always go. */
export function PendingLine({
  slug,
  qty,
  known,
}: {
  slug: string;
  qty: number;
  known?: KnownProduct;
}) {
  const name = known?.name ?? slug;
  return (
    <li className="line line--pending" data-slug={slug}>
      <span className="well" aria-hidden="true" />
      <div className="line-main">
        <h3 className="line-name">
          {name}
          {known?.rx !== false && <RxBadge />}
        </h3>
        <p className="line-qty">
          {P.qty} <b>{qty}</b>
        </p>
      </div>
      <p className="line-price">
        <span className="line-pending">{P.pricePending}</span>
      </p>
      <div className="line-ctl">
        <button
          type="button"
          className="line-remove"
          data-remove
          aria-label={CART_COPY.removeFrom(name)}
          onClick={() => {
            cartStore.dispatch({ type: "remove", slug });
            announce(CART_COPY.removed(name));
          }}
        >
          <TrashIcon />
          <span>{CART_COPY.remove}</span>
        </button>
      </div>
    </li>
  );
}

/** A group of lines with the prototype's `.group-head` (the Rx group carries the Rx mark). */
export function Group({
  id,
  title,
  rows,
  children,
}: {
  id: string;
  title: string;
  rows: Row[];
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <header className="group-head">
        {id === "g-rx" && <RxBadge size="lg" />}
        <h2 id={id} tabIndex={-1}>
          {title} <span className="count">{P.medicines(rows.length)}</span>
        </h2>
        {children}
      </header>
      <ul className="lines">{rows.map((r) => r.node)}</ul>
    </section>
  );
}

/** Checkout: signed in, a link to it; otherwise to /login?next=/checkout, whose plain click opens the sign-in dialog. */
export function CheckoutLink({
  signedIn,
  className,
  tabIndex,
  anchorRef,
  children,
}: {
  signedIn: boolean;
  className: string;
  tabIndex?: number;
  anchorRef?: Ref<HTMLAnchorElement>;
  children: ReactNode;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (signedIn || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openLogin(ROUTES.checkout);
  };
  // A plain <a>: /checkout is pending until phase O, so it is not prefetched.
  return (
    <a
      ref={anchorRef}
      className={className}
      href={signedIn ? ROUTES.checkout : guestCheckout}
      tabIndex={tabIndex}
      onClick={onClick}
      data-checkout
    >
      {children}
    </a>
  );
}

/** The receipt's notes: cash on delivery only while online payments are off (ruling); the prototype's online-payment and refund lines once they are on. */
export function ReceiptNotes({ onlinePayments }: { onlinePayments: boolean }) {
  if (!onlinePayments) {
    return (
      <p className="receipt-note">
        <Icon name="cash" />
        <span>{P.codNote}</span>
      </p>
    );
  }
  return (
    <>
      <p className="receipt-note">
        <Icon name="cash" />
        <span>{P.onlineNote}</span>
      </p>
      <p className="receipt-note">
        <Icon name="shield" />
        <span>{P.refundNote}</span>
      </p>
    </>
  );
}
