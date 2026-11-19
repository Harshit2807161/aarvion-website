import { CartPill } from "@/components/cart/cart-pill";
import { AnnounceBar } from "@/components/shell/announce-bar";
import { SkipLink } from "@/components/shell/skip-link";
import { StoreFooter } from "@/components/shell/store-footer";
import { StoreHeader } from "@/components/shell/store-header";
import { getCachedCategories } from "@/lib/catalogue/cached";

/**
 * Layout for every customer-facing route: skip link, announcement line, sticky header, the
 * page, then the store footer. It lives here, not in the root layout, so admin, staff and
 * /dev routes get none of the chrome.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Read at build time (cached, tagged `catalogue`): the build needs a seeded database.
  const live = (await getCachedCategories()).filter((c) => c.status === "live");
  return (
    <>
      <SkipLink />
      <AnnounceBar />
      <StoreHeader cart={<CartPill />} />
      {children}
      <StoreFooter categories={live} />
    </>
  );
}
