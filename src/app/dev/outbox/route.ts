import { jsonResponse } from "@/server/http";
import { requireDevRoute } from "@/server/dev-only";
import { readOutbox } from "@/server/providers/outbox";

export const dynamic = "force-dynamic";

// Deliberately not wrapped in withErrors: requireDevRoute() throws Next's notFound() control-flow
// error, which Next must see to answer 404 (withErrors would turn it into a 500).
export async function GET(req: Request): Promise<Response> {
  requireDevRoute();
  const to = new URL(req.url).searchParams.get("to");
  if (!to) return jsonResponse({ error: "missing_to" }, { status: 400 });
  const messages = await readOutbox(to);
  return jsonResponse({
    messages: messages.map(({ channel, to, createdAt, payload }) => ({
      channel,
      to,
      createdAt,
      payload,
    })),
  });
}
