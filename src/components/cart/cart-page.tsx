"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { buttonClass } from "@/components/base/button-class";
import { Icon } from "@/components/base/icon";
import { EmptyState } from "@/components/shell/empty-state";
import { ROUTES } from "@/config/routes";
import { CART_LIMITS, cartCount } from "@/lib/cart/cart";
import { cartStore, type CartMode } from "@/lib/cart/store";
import { useCartLines } from "@/lib/cart/use-cart-lines";
import { useCartView } from "@/lib/cart/use-cart-view";
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

const P = CART_COPY.page;
const S = CART_COPY.summary;

const packs = (n: number) => `${n} ${n === 1 ? S.pack : S.packs}`;
const getServerMode = (): CartMode => "unknown";
const noSubscribe = () => () => {};

/**
 * The /cart page body (the prototype's `.cart-grid`). Prices come only from the server-priced view
 * (`useCartView`); a line not priced yet is a pending row with a working Remove, and the receipt
 * shows no totals before the first priced view. On mount it starts pricing a stored guest cart at
 * once (`cartStore.price()`) instead of waiting for `CartSync`'s idle mount.
 *
 * With no lines it shows the empty state at once, without waiting for `CartSync`; "Loading your
 * cart…" is only for the server render (and hydration), which cannot know the cart.
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
  const mode = useSyncExternalStore(cartStore.subscribe, cartStore.getMode, getServerMode);
  const count = cartCount(lines);
  // The server render (and the hydration pass) cannot know the cart: it shows the loading state.
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  useEffect(() => cartStore.price(), []);

  const signedIn = mode === "user";
  const loading = !hydrated;

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
  const unpriced = priced.length === 0; // no priced view yet: no totals at all

  const hasLines = count > 0;

  if (loading) return <CartLoading />;

  if (!hasLines) {
    return (
      <EmptyState
        count="0"
        title={P.emptyTitle}
        actions={
          <Link className={buttonClass({ variant: "forest", size: "lg" })} href={ROUTES.medicines}>
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
        <div className="cart-main">
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
              className={buttonClass({ variant: "forest", size: "lg", block: true })}
            >
              {P.checkout}
              <Icon name="arrow" />
            </CheckoutLink>
            <ReceiptNotes onlinePayments={onlinePayments} />
          </div>
        </aside>
      </div>
    </>
  );
}
