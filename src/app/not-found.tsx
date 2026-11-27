import type { Metadata } from "next";
import { NotFoundBody } from "@/components/shell/not-found-body";
import { withStoreChrome } from "@/components/shell/store-chrome";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Next renders this for a URL that matches no route. It sits outside the `(store)` layout, so it
 * wraps itself in the same chrome, which lets a shopper search or go home. A `notFound()` inside
 * `(store)` uses `(store)/not-found.tsx`, already in the chrome. (`/dev/*` 404s come from the
 * proxy and stay bare.)
 */
export default async function NotFound() {
  return withStoreChrome(<NotFoundBody />);
}
