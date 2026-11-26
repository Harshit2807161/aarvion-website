import { Suspense } from "react";
import { withStoreChrome } from "@/components/shell/store-chrome";

/**
 * Layout for every customer-facing route. The chrome (skip link, announcement line, header,
 * category bar, footer) lives in `withStoreChrome`, shared with the root `not-found`. It is
 * mounted here, not in the root layout, so admin, staff and /dev routes get none of it.
 *
 * The page sits in a Suspense boundary because `(store)/not-found.tsx` makes Next wrap it in a
 * not-found boundary that reads `usePathname()`; with Cache Components that hook is runtime data
 * and must not block the prerender of the chrome around it.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  return withStoreChrome(<Suspense>{children}</Suspense>);
}
