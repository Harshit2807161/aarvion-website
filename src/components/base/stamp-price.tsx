import { cn } from "@/lib/cn";
import { percentOff, sellingPricePaise } from "@/server/catalogue/pricing";
import { Rupees } from "./rupees";

/**
 * The dot-matrix price: the struck MRP, the store's % off, and our price below. Takes only
 * the MRP; the price and the % always come from pricing.ts (src/lib/price-source.test.ts
 * keeps UI code from re-deriving them). Throws RangeError for an MRP that cannot carry a price.
 */
export function StampPrice({ mrpPaise, className }: { mrpPaise: number; className?: string }) {
  const price = sellingPricePaise(mrpPaise);
  const off = percentOff(mrpPaise);
  return (
    <p className={cn("stamp", className)}>
      <span className="stamp-top">
        <s className="stamp-mrp">
          <span className="sr-only">Printed </span>
          <span className="dm">
            MRP <Rupees paise={mrpPaise} />
          </span>
        </s>
        <span className="off">
          <span className="sr-only">, </span>
          {off}% off
        </span>
      </span>
      <span className="stamp-price">
        <span className="sr-only">, our price </span>
        <span className="dm">
          <Rupees paise={price} />
        </span>
      </span>
    </p>
  );
}

/** Compact solid-mono price for lists and the cart: struck MRP, then the price. */
export function PriceInline({ mrpPaise }: { mrpPaise: number }) {
  return (
    <span className="price-inline">
      <s>
        MRP <Rupees paise={mrpPaise} />
      </s>
      <b>
        <Rupees paise={sellingPricePaise(mrpPaise)} />
      </b>
    </span>
  );
}
