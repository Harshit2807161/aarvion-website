import { ButtonLink } from "@/components/base/button";
import { EmptyState } from "@/components/shell/empty-state";
import { OperateShell } from "@/components/shell/operate-shell";
import { ROUTES } from "@/config/routes";

/**
 * The 404 page's body, with no chrome: shared by the root `not-found` (which wraps it in the
 * chrome) and `(store)/not-found`, which already sits inside the `(store)` layout's chrome.
 */
export function NotFoundBody() {
  return (
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
    </OperateShell>
  );
}
