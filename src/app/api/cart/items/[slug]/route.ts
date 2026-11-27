import { requireUser } from "@/server/auth/guards";
import { SetBody, cartResponse, limitCartUser, slugParam } from "@/server/cart/http";
import { removeFromCart, setCartQty } from "@/server/cart/service";
import { getDeps } from "@/server/deps";
import { readJson, withErrors } from "@/server/http";
import { assertSameOrigin } from "@/server/security/origin";

type Ctx = { params: Promise<{ slug: string }> };

/** `PUT /api/cart/items/[slug] { qty }`: sets a line to `qty` (0 to 10; 0 removes it). */
export const PUT = withErrors(async (req, ctx: Ctx) => {
  assertSameOrigin(req);
  const auth = await requireUser(req);
  const slug = await slugParam(ctx); // a malformed slug is refused before it costs rate-limit budget
  await limitCartUser(auth);
  const { qty } = await readJson(req, SetBody);
  return cartResponse(await setCartQty(auth.user._id, slug, qty, getDeps().now()), auth);
});

/** `DELETE /api/cart/items/[slug]`: removes a line; an absent one is still 200. */
export const DELETE = withErrors(async (req, ctx: Ctx) => {
  assertSameOrigin(req);
  const auth = await requireUser(req);
  const slug = await slugParam(ctx); // a malformed slug is refused before it costs rate-limit budget
  await limitCartUser(auth);
  return cartResponse(await removeFromCart(auth.user._id, slug, getDeps().now()), auth);
});
