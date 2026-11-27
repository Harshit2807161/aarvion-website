import { Rupees } from "@/components/base/rupees";
import type { CartTotals } from "@/server/cart/service";
import { CART_COPY } from "./cart-copy";

const S = CART_COPY.summary;

/** "1 pack", "3 packs". */
const packs = (n: number) => `${n} ${n === 1 ? S.pack : S.packs}`;

/**
 * The receipt, as the prototype's `sumHTML` draws it. `totals` are the server-priced ones from
 * `useCartView`. While `updating` they may not match the cart, so the summary says so beside
 * them; it never shows them as current. No hooks and no live region (the page has one, and
 * `announce()` owns it), so it renders on the server or in a client tree.
 */
export function CartSummary({
  totals,
  kind,
  updating = false,
}: {
  totals: CartTotals;
  kind: "full" | "mini";
  updating?: boolean;
}) {
  const payable = (
    <div className="sum-total">
      <dt>{S.payable}</dt>
      <dd>
        <span className="dm" data-stamp>
          <Rupees paise={totals.payablePaise} />
        </span>
      </dd>
    </div>
  );
  const busy = updating ? <p className="sum-updating">{S.updating}</p> : null;

  if (kind === "mini") {
    return (
      <>
        <dl className="sum sum--mini" data-updating={updating || undefined}>
          {payable}
        </dl>
        {busy}
        <p className="sum-tax">
          {S.mrp} <Rupees paise={totals.mrpPaise} /> {S.less} <Rupees paise={totals.discountPaise} />{" "}
          {S.discount}
          <br />
          {S.freeDelivery} · {S.tax}
        </p>
      </>
    );
  }

  return (
    <>
      <dl className="sum" data-updating={updating || undefined}>
        <div>
          <dt>{S.mrpTotal}</dt>
          <dd>
            <Rupees paise={totals.mrpPaise} />
          </dd>
        </div>
        <div className="sum-off">
          <dt>
            {S.discount}{" "}
            <small>
              <Rupees paise={totals.discountPerPackPaise} /> × {packs(totals.packs)}
            </small>
          </dt>
          <dd>
            <span aria-hidden="true">−</span>
            <span className="sr-only">minus </span>
            <Rupees paise={totals.discountPaise} />
          </dd>
        </div>
        <div className="sum-free">
          <dt>{S.delivery}</dt>
          <dd>{S.free}</dd>
        </div>
        {payable}
      </dl>
      {busy}
      <p className="sum-tax">{S.tax}</p>
    </>
  );
}
