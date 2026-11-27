import { z } from "zod";
import type { AuthContext } from "../auth/guards.ts";
import { sessionRefreshHeaders } from "../auth/guards.ts";
import { Slug } from "../catalogue/schema.ts";
import { getDeps } from "../deps.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { hitRateLimit } from "../security/rate-limit.ts";
import type { CartResult } from "./service.ts";

/** What the cart routes share: input schemas, the per-user limit and the response mapping. */
const qty = (min: number) => z.number().int().min(min).max(10);
export const AddBody = z.strictObject({ slug: Slug, qty: qty(1) });
export const SetBody = z.strictObject({ qty: qty(0) });
export const LinesBody = z.strictObject({
  lines: z.array(z.strictObject({ slug: Slug, qty: qty(1) })).max(20),
});

/** 120 cart changes a minute per user. */
export async function limitCartUser(auth: AuthContext): Promise<void> {
  const r = await hitRateLimit({
    key: `cart:user:${auth.user._id.toHexString()}`,
    limit: 120,
    windowMs: 60_000,
    now: getDeps().now(),
  });
  if (!r.allowed) throw new HttpError(429, "rate_limited", r.retryAfterSec);
}

/** A route's slug parameter, or 400 `invalid_request`. */
export async function slugParam(ctx: { params: Promise<{ slug: string }> }): Promise<string> {
  const parsed = Slug.safeParse((await ctx.params).slug);
  if (!parsed.success) throw new HttpError(400, "invalid_request");
  return parsed.data;
}

/** 200 with the view, 404 `product_not_found` or 409 a cap, the last two carrying the unchanged cart. */
export function cartResponse(result: CartResult, auth: AuthContext): Response {
  const headers = sessionRefreshHeaders(auth);
  if (result.ok) return jsonResponse(result.cart, { headers });
  const status = result.error === "product_not_found" ? 404 : 409;
  return jsonResponse({ error: result.error, cart: result.cart }, { status, headers });
}
