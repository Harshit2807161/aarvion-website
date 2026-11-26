import { Suspense, type ReactNode } from "react";
import { CartPill } from "@/components/cart/cart-pill";
import { CartReconcile } from "@/components/cart/cart-reconcile";
import { HeaderSearch } from "@/components/search/header-search";
import { STRENGTH_CHIP_FAMILY, strengthChips } from "@/components/search/strength-chips";
import { AnnounceBar } from "@/components/shell/announce-bar";
import { CategoryBar } from "@/components/shell/category-bar";
import { SkipLink } from "@/components/shell/skip-link";
import { StoreFooter } from "@/components/shell/store-footer";
import { StoreHeader } from "@/components/shell/store-header";
import { getCachedCategories, getCachedFamily, getCachedProducts } from "@/lib/catalogue/cached";

/**
 * The customer chrome around a page: skip link, announcement line, sticky header, category bar,
 * the page, then the store footer. Two places need it: the `(store)` layout, and the root
 * `not-found`, which Next renders for URLs that match no route and which sits outside the
 * `(store)` group. Both call this, so the chrome exists once. It is a function, not a component,
 * so the two callers (and their tests) can await it directly.
 */
export async function withStoreChrome(children: ReactNode): Promise<ReactNode> {
  // Read at build time (cached, tagged `catalogue`): the build needs a seeded database.
  const live = (await getCachedCategories()).filter((c) => c.status === "live");
  const slugs = (await getCachedProducts()).map((p) => p.slug);
  const chips = strengthChips(await getCachedFamily(STRENGTH_CHIP_FAMILY));
  return (
    <>
      {/* usePathname reads the URL: suspended so a page rendered at request time stays valid */}
      <Suspense>
        <SkipLink />
      </Suspense>
      <AnnounceBar />
      <StoreHeader search={<HeaderSearch chips={chips} />} cart={<CartPill />} />
      <CartReconcile slugs={slugs} />
      <CategoryBar categories={live} />
      {children}
      <StoreFooter categories={live} />
    </>
  );
}
