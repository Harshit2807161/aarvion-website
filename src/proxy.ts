import { NextResponse } from "next/server";
import { isMockForbidden } from "@/server/providers/guard";

/**
 * Dev-only pages and tools live under /dev/*. Wherever mocks are forbidden (production, or a
 * production database) they must answer a real HTTP 404 before anything renders. A page that
 * calls requireDevRoute() cannot do that under Cache Components: the shell streams first, so
 * the notFound() lands on an already-sent 200. Deciding here, ahead of rendering, fixes the
 * status; requireDevRoute() stays in each page and route as a second guard.
 */
export function proxy(): NextResponse {
  if (isMockForbidden())
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  return NextResponse.next();
}

export const config = { matcher: "/dev/:path*" };
