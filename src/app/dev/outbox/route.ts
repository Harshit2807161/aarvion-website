import { connection } from "next/server";
import { jsonResponse } from "@/server/http";
import { requireDevRoute } from "@/server/dev-only";
import { readOutbox } from "@/server/providers/outbox";

// requireDevRoute() runs after connection(), so the 404 decision uses the request-time
// environment, not the build's.
export async function GET(req: Request): Promise<Response> {
  await connection();
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
