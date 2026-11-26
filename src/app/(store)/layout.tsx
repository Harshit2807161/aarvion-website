import { Suspense } from "react";
import { withStoreChrome } from "@/components/shell/store-chrome";

/**
 * Layout for every customer-facing route. The chrome (skip link, announcement line, header,
 * category bar, footer) lives in `withStoreChrome`, shared with the root `not-found`. It is
 * mounted here, not in the root layout, so admin, staff and /dev routes get none of it.
 *
 * The page sits in Suspense: `(store)/not-found.tsx` makes Next wrap it in a boundary that reads
 * `usePathname()`, which is runtime data under Cache Components and must not block the chrome.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  return withStoreChrome(<Suspense>{children}</Suspense>);
}
