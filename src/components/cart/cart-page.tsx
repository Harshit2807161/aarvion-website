"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/base/button-class";
import { Icon } from "@/components/base/icon";
import { Rupees } from "@/components/base/rupees";
import { EmptyState } from "@/components/shell/empty-state";
import { ROUTES } from "@/config/routes";
import { CART_LIMITS, cartCount } from "@/lib/cart/cart";
import { useCartLines } from "@/lib/cart/use-cart-lines";
import { useCartView } from "@/lib/cart/use-cart-view";
import { cn } from "@/lib/cn";
import type { PricedLine } from "@/server/cart/service";
import { CART_COPY } from "./cart-copy";
import { CartLineItem } from "./cart-line";
import { CartLoading } from "./cart-page-loader";
import {
  CheckoutLink,
  Group,
  PendingLine,
  ReceiptNotes,
  type KnownProduct,
  type Row,
} from "./cart-page-parts";
import { CartSummary } from "./cart-summary";
import { useCartSession, useRemoveFocus } from "./use-cart-surface";

const P = CART_COPY.page;
const S = CART_COPY.summary;

const packs = (n: number) => `${n} ${n === 1 ? S.pack : S.packs}`;

/**
 * The /cart page body (the prototype's `.cart-grid`). Prices come only from the server-priced view
 * (`useCartView`); a line not priced yet is a pending row with a working Remove, and the receipt
 * shows no totals before the first priced view. On mount it starts pricing a stored guest cart at
 * once (`cartStore.price()`) instead of waiting for `CartSync`'s idle mount. After a Remove, focus
 * goes to the next line's Remove, else the previous line's, else the empty state's link.
 *
 * With no lines it shows the empty state without waiting for `CartSync`: "Loading your
 * cart…" is only for the server render, while the page's own session check is pending (one
 * request), and while a confirmed signed-in cart is loading. For that it
 * asks the session itself on mount and, when someone is signed in, signs the store in (the store
 * shares one sign-in between this and `CartSync`); a failed sign-in falls back to the empty state.
 * The session gate and the focus after Remove are `useCartSession` and `useRemoveFocus`, shared
 * with the drawer.
 */
export function CartPage({
  medicineWord,
  onlinePayments,
  known,
}: {
  /** How many medicines the store sells, as the empty state words it ("eleven"); worded on the server, so `countWord` stays out of the client bundle. */
  medicineWord: string;
  onlinePayments: boolean;
  known: Readonly<Record<string, KnownProduct>>;
}) {
  const lines = useCartLines();
  const { lines: priced, totals, updating } = useCartView();
  const count = cartCount(lines);
  const { mode, signedIn, loading } = useCartSession(count);

  // The rows, in cart order: priced ones from the view, the rest pending.
  const facts = new Map<string, PricedLine>(priced.map((l) => [l.slug, l]));
  const rows: Row[] = Object.entries(lines).map(([slug, qty]) => {
    const line = facts.get(slug);
    if (line) {
      return {
        slug,
        rx: line.rxRequired,
        node: <CartLineItem key={slug} line={line} variant="full" />,
      };
    }
    const k = known[slug];
    return {
      slug,
      rx: k?.rx !== false,
      node: <PendingLine key={slug} slug={slug} qty={qty} known={k} />,
    };
  });
  const order = rows.map((r) => r.slug);
  const unpriced = priced.length === 0; // no priced view yet: no totals at all

  // Focus after Remove: the next line's Remove, else the previous line's, else the empty state's link.
  const mainRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLAnchorElement>(null);
  const onRemoveClick = useRemoveFocus(order, mainRef, emptyRef);

  // The phone dock shows while the receipt's Checkout is out of view.
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const [anchorSeen, setAnchorSeen] = useState(true);

  const hasLines = count > 0;
  useEffect(() => {
    const el = anchorRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([en]) => setAnchorSeen(en!.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [hasLines]);
  const dockShown = hasLines && !anchorSeen;

  if (loading) return <CartLoading />;

  if (!hasLines) {
    return (
      <EmptyState
        count="0"
        title={P.emptyTitle}
        actions={
          <Link
            ref={emptyRef}
            className={buttonClass({ variant: "forest", size: "lg" })}
            href={ROUTES.medicines}
          >
            {P.browseAll(medicineWord)}
          </Link>
        }
      >
        {P.emptyBody}
      </EmptyState>
    );
  }

  const rxRows = rows.filter((r) => r.rx);
  const otcRows = rows.filter((r) => !r.rx);

  return (
    <>
      <div className="cart-grid">
        <div className="cart-main" ref={mainRef} onClickCapture={onRemoveClick}>
          {rxRows.length > 0 && (
            <Group id="g-rx" title={P.rxHead} rows={rxRows}>
              <p>{P.rxNote}</p>
            </Group>
          )}
          {otcRows.length > 0 && <Group id="g-otc" title={P.otcHead} rows={otcRows} />}
          {count >= CART_LIMITS.perOrder && (
            <p className="note cart-limit">
              <Icon name="info" />
              <span>{P.orderFull}</span>
            </p>
          )}
        </div>
        <aside className="cart-aside" aria-labelledby="sum-title">
          <div className="receipt" aria-busy={unpriced || undefined}>
            <div className="receipt-head">
              <h2 className="h-sub" id="sum-title">
                {P.summaryTitle}
              </h2>
              <span className="text-xs muted mono">{packs(count)}</span>
            </div>
            {unpriced ? (
              <p className="sum-updating">{S.updating}</p>
            ) : (
              <CartSummary totals={totals} kind="full" updating={updating} />
            )}
            <CheckoutLink
              signedIn={signedIn}
              checkSession={mode === "unknown"}
              anchorRef={anchorRef}
              className={buttonClass({ variant: "forest", size: "lg", block: true })}
            >
              {P.checkout}
              <Icon name="arrow" />
            </CheckoutLink>
            <ReceiptNotes onlinePayments={onlinePayments} />
          </div>
        </aside>
      </div>
      <div className={cn("dock", dockShown && "is-shown")} inert={!dockShown} data-dock>
        <div className="dock-total">
          <small>{S.payable}</small>
          {/* Never a stale total as current: while re-pricing the dock says so instead. */}
          <b>{updating ? S.updating : <Rupees paise={totals.payablePaise} />}</b>
        </div>
        <CheckoutLink
          signedIn={signedIn}
          checkSession={mode === "unknown"}
          tabIndex={-1}
          className={buttonClass({ variant: "forest", size: "lg" })}
        >
          {P.checkout}
        </CheckoutLink>
      </div>
    </>
  );
}
