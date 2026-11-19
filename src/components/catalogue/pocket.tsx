import Image from "next/image";
import { Fragment } from "react";
import { RxBadge } from "@/components/base/badge";
import { StampPrice } from "@/components/base/stamp-price";
import { CartControl } from "@/components/cart/cart-control";
import {
  actives,
  fullComposition,
  packDisplay,
  pocketImage,
  type PocketProduct,
} from "@/lib/catalogue/display";

/**
 * The foil pocket, the storefront's product card (v2 prototype `build.mjs` `pocket()`): the pack
 * under a clear dome on print-field foil, then the name with its Rx mark, the actives, the pack,
 * the stamp price and Add to cart. Styles: src/styles/pocket.css. The home rails, the category
 * page and the product page all render this; the list around it (`ul`) is theirs.
 *
 * No hooks, so it renders on the server or inside a client tree. Prices come only from
 * StampPrice, and cart changes are spoken only by the page's single `#live` region (CartControl),
 * so the pocket adds no live region of its own.
 *
 * `priority` is for the one pocket that is the page's LCP candidate: an eager, high-priority
 * fetch, never a `preload` [C24]. Every other pocket is lazy.
 */
export function Pocket({
  product,
  heading = "h3",
  priority = false,
}: {
  product: PocketProduct;
  heading?: "h2" | "h3" | "h4";
  priority?: boolean;
}) {
  const Heading = heading;
  const image = pocketImage(product);
  const composition = fullComposition(product.composition);
  return (
    <li
      className="pocket"
      id={`p-${product.slug}`}
      data-slug={product.slug}
      data-name={product.name}
    >
      <div className="pocket-in">
        <div className="blister">
          <Image
            className="pocket-img"
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(max-width: 719px) 40vw, 200px"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
          />
        </div>
        <div className="pocket-body">
          <Heading className="pocket-name">
            <span>{product.name}</span>
            {product.rxRequired && <RxBadge />}
          </Heading>
          {/* The actives are what fits two lines; the full composition is the title and what AT reads. */}
          <p className="pocket-salt" title={composition}>
            <span aria-hidden="true">
              {actives(product.composition).map((a, i) => (
                <Fragment key={i}>
                  {i > 0 && " + "}
                  {a.name} <span className="str">{a.strength}</span>
                </Fragment>
              ))}
            </span>
            <span className="sr-only">{composition}</span>
          </p>
          <p className="pocket-pack">{packDisplay(product)}</p>
          <div className="pocket-foot">
            <StampPrice mrpPaise={product.mrpPaise} />
            <CartControl slug={product.slug} name={product.name} />
          </div>
        </div>
      </div>
    </li>
  );
}
