import { revalidateCatalogue } from "@/lib/catalogue/revalidate";
import { requireDevRoute } from "@/server/dev-only";
import { withErrors } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";

const handle = withErrors(async (req) => {
  assertSameOrigin(req);
  revalidateCatalogue();
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
});

/** Dev-only: expire the cached catalogue (e2e freshness checks, local catalogue edits). */
export async function POST(req: Request): Promise<Response> {
  // Before the origin check, so a disallowed environment answers 404 to every request.
  requireDevRoute();
  return handle(req);
}
