// Ruling F15: `next/navigation` is the single framework import allowed under src/server/**.
// Its notFound() is the only way to answer 404 from a route handler or page.
import { notFound } from "next/navigation";
import { isMockForbidden } from "./providers/guard.ts";

/** Call first in every dev-only route or page: a 404 whenever mocks are forbidden. */
export function requireDevRoute(): void {
  if (isMockForbidden()) notFound();
}
