import { ButtonLink } from "@/components/base/button";
import { EmptyState } from "@/components/shell/empty-state";
import { OperateShell } from "@/components/shell/operate-shell";
import { ROUTES } from "@/config/routes";

/** The 404 page's content, shared by the root `not-found` (which adds the chrome) and `(store)/not-found` (inside the chrome). */
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
