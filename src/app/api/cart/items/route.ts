import { requireUser } from "@/server/auth/guards";
import { AddBody, cartResponse, limitCartUser } from "@/server/cart/http";
import { addToCart } from "@/server/cart/service";
import { getDeps } from "@/server/deps";
import { readJson, withErrors } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";

/** `POST /api/cart/items { slug, qty }`: adds `qty` packs (1 to 10). */
export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const auth = await requireUser(req);
  await limitCartUser(auth);
  const { slug, qty } = await readJson(req, AddBody);
  return cartResponse(await addToCart(auth.user._id, slug, qty, getDeps().now()), auth);
});
