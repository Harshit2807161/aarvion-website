// Ruling F15: `next/navigation` is the single framework import allowed under src/server/**.
// Its notFound() is the only way to answer 404 from a route handler or page.
import { notFound } from "next/navigation";
import { isMockForbidden } from "./providers/guard.ts";

/**
 * A 404 whenever mocks are forbidden. Call it first in every dev-only handler; in a GET or a page,
 * call it right after `await connection()` (C8), so the decision uses the request-time environment.
 */
export function requireDevRoute(): void {
  if (isMockForbidden()) notFound();
}
