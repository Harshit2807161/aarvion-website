"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/base/button";
import { EmptyState } from "@/components/shell/empty-state";
import { OperateShell } from "@/components/shell/operate-shell";
import { ROUTES } from "@/config/routes";

/**
 * Shown when a page throws while rendering. Only the error's name and Next's digest are logged
 * (the digest matches the server log line); the message and stack can hold user data, so they
 * are neither logged nor shown. `retry` re-fetches and re-renders the page (Next 16.3+); plain
 * `reset` would only clear the error and show the same failure again for a server error.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("page error", { name: error.name, digest: error.digest });
  }, [error]);

  return (
    <OperateShell
      title="Something went wrong"
      sub="This page didn’t load. Try again, or go back to the home page."
    >
      <EmptyState
        count="!"
        actions={
          <>
            <Button variant="forest" onClick={() => retry()}>
              Try again
            </Button>
            <ButtonLink variant="quiet" href={ROUTES.home}>
              Go to the home page
            </ButtonLink>
          </>
        }
      />
    </OperateShell>
  );
}
