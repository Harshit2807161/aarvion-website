import { connection } from "next/server";
import { requireUser, sessionRefreshHeaders } from "@/server/auth/guards";
import { getCart } from "@/server/cart/service";
import { getDeps } from "@/server/deps";
import { jsonResponse, withErrors } from "@/server/http";

/** `GET /api/cart`: the signed-in user's cart, repriced from Mongo (never the cached catalogue). */
export const GET = withErrors(async (req) => {
  await connection();
  const auth = await requireUser(req);
  const cart = await getCart(auth.user._id, getDeps().now());
  return jsonResponse(cart, { headers: sessionRefreshHeaders(auth) });
});
