import type { Metadata } from "next";
import type { KnownProduct } from "@/components/cart/cart-page-parts";
import { CartPageLoader } from "@/components/cart/cart-page-loader";
import { CART_COPY } from "@/components/cart/cart-copy";
import { OperateShell } from "@/components/shell/operate-shell";
import { ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";
import { getCachedProducts } from "@/lib/catalogue/cached";
import { countWord } from "@/lib/catalogue/display";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

const P = CART_COPY.page;

/**
 * /cart: a static shell (the band, the sheet) with the cart itself on the client, loaded as its
 * own chunk behind a leaf Suspense (`CartPageLoader`). Prices never
 * come from here: the cached catalogue gives only the empty state's count and, for a line the
 * server has not priced yet, its name and Rx flag (ruling: prices come from the quote or cart API).
 */
export default async function CartRoute() {
  const products = await getCachedProducts();
  const known: Record<string, KnownProduct> = Object.fromEntries(
    products.map((p) => [p.slug, { name: p.name, rx: p.rxRequired }]),
  );
  return (
    <OperateShell title={P.title} sub={P.sub} back={{ href: ROUTES.medicines, label: P.back }}>
      <CartPageLoader
        medicineWord={countWord(products.length).toLowerCase()}
        onlinePayments={SITE_CONFIG.onlinePayments}
        known={known}
      />
    </OperateShell>
  );
}
