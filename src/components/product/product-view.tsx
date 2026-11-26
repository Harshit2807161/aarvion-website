import { RxBadge } from "@/components/base/badge";
import { StampPrice } from "@/components/base/stamp-price";
import { CartControl } from "@/components/cart/cart-control";
import { Pocket } from "@/components/catalogue/pocket";
import { OperateShell } from "@/components/shell/operate-shell";
import { ROUTES } from "@/config/routes";
import { fullComposition, packDisplay } from "@/lib/catalogue/display";
import { CART_LIMITS } from "@/lib/cart/cart";
import type { PublicProduct } from "@/server/catalogue/queries";
import type { Category } from "@/server/catalogue/schema";
import { Gallery } from "./gallery";
import { ProductFacts } from "./product-facts";
import { VariantSwitcher } from "./variant-switcher";

/**
 * The product page body (spec C4): the photos beside a buy box that reads brand, composition,
 * pack, price, then the strengths and Add to cart; below it the Legal Metrology facts and a strip
 * of related packs. Everything comes from the catalogue record: a fact it lacks renders "To be
 * added" (ProductFacts), and the Rx note shows only for a product that requires one [C25].
 * Server-safe, and no live region: CartControl speaks through the page's single `#live`.
 */
export function ProductView({
  product,
  family,
  category,
  related,
}: {
  product: PublicProduct;
  family: readonly PublicProduct[];
  category: Pick<Category, "slug" | "name">;
  related: readonly PublicProduct[];
}) {
  return (
    <OperateShell back={{ href: ROUTES.category(category.slug), label: category.name }}>
      <div className="product">
        <Gallery images={product.images} imageSource={product.imageSource} name={product.name} />
        <div className="buy">
          <div className="buy-brand" data-hierarchy="brand">
            <h1 className="product-name">{product.name}</h1>
            {product.rxRequired && <RxBadge size="lg" />}
          </div>
          <p className="product-salt" data-hierarchy="composition">
            {fullComposition(product.composition)}
          </p>
          <p className="product-pack" data-hierarchy="pack">
            {`${packDisplay(product)} · ${product.dosageForm}`}
          </p>
          <div className="product-price" data-hierarchy="price">
            <StampPrice mrpPaise={product.mrpPaise} />
            <p className="tax-note">Inclusive of all taxes</p>
          </div>
          <VariantSwitcher family={family} current={product} />
          <CartControl slug={product.slug} name={product.name} />
          <p className="order-limit">Up to {CART_LIMITS.perProduct} packs of each medicine per order.</p>
          {product.rxRequired && (
            <p className="rx-note">
              Requires a valid prescription. You add it at checkout, and a pharmacist checks it
              before your order is packed.
            </p>
          )}
        </div>
      </div>
      <section className="product-facts-block" aria-labelledby="facts-h">
        <h2 id="facts-h" className="h-sub">
          Product details
        </h2>
        <ProductFacts product={product} />
      </section>
      {related.length > 0 && (
        <section className="related" aria-labelledby="related-h">
          <h2 id="related-h" className="h-section">
            More in {category.name}
          </h2>
          <ul className="related-row">
            {related.map((p) => (
              <Pocket key={p.slug} product={p} heading="h3" />
            ))}
          </ul>
        </section>
      )}
    </OperateShell>
  );
}
