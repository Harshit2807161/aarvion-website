import { withStoreChrome } from "@/components/shell/store-chrome";

/**
 * Layout for every customer-facing route. The chrome (skip link, announcement line, header,
 * category bar, footer) lives in `withStoreChrome`, shared with the root `not-found`. It is
 * mounted here, not in the root layout, so admin, staff and /dev routes get none of it.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  return withStoreChrome(children);
}
