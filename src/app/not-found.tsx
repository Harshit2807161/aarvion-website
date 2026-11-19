import type { Metadata } from "next";
import { ButtonLink } from "@/components/base/button";
import { EmptyState } from "@/components/shell/empty-state";
import { OperateShell } from "@/components/shell/operate-shell";
import { withStoreChrome } from "@/components/shell/store-chrome";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Next renders this for a URL that matches no route, and for `notFound()` outside a group
 * `not-found`. It sits outside the `(store)` layout, so it wraps itself in the same chrome, which
 * lets a shopper search or go home. (`/dev/*` 404s come from the proxy and stay bare.)
 */
export default async function NotFound() {
  return withStoreChrome(
    <OperateShell
      title="We can’t find that page"
      sub="The link may be old, or the page may have moved."
    >
      <EmptyState
        count="404"
        actions={
          <>
            <ButtonLink variant="forest" href={ROUTES.home}>
              Go to the home page
            </ButtonLink>
            <ButtonLink variant="quiet" href={ROUTES.medicines}>
              Browse medicines
            </ButtonLink>
          </>
        }
      />
    </OperateShell>,
  );
}
