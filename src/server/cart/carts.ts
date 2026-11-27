import type { ObjectId } from "mongodb";
import { getDb } from "../db/client.ts";
import { HttpError } from "../http.ts";
import type { CartBlock, CartLine } from "./rules.ts";

export const CARTS_COLLECTION = "carts";

/**
 * One document per user, `_id` = the user's id. `lines` is an array in add order, never a
 * slug-keyed object. `rev` is the compare-and-set version. No price is ever stored: prices are
 * derived from the catalogue's MRP when a cart is read (`service.ts`).
 */
export type CartDoc = {
  _id: ObjectId;
  lines: CartLine[];
  rev: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Lost races before a write gives up with 409 `cart_conflict`. Every lost race means another
 * writer won, so with N concurrent writers one needs at most N attempts. The plan's ruling says 3;
 * that cannot satisfy its own Review Focus 1 (25 parallel adds must all land), so this is 25, the
 * most concurrent writers a single cart can see before it hits its 20-pack cap. A double tap or
 * two tabs (2 writers) never comes near it.
 */
const MAX_ATTEMPTS = 25;
const BACKOFF_MS = 3;

async function carts() {
  return (await getDb()).collection<CartDoc>(CARTS_COLLECTION);
}

export async function readCart(userId: ObjectId): Promise<CartDoc | null> {
  return (await carts()).findOne({ _id: userId });
}

export type CartMutation = {
  lines: readonly CartLine[];
  blocked?: CartBlock | null;
  trimmed?: boolean;
};

/**
 * Applies `fn` to the user's current lines and stores the result with a compare-and-set on
 * `rev`, so two writers can never both win from the same starting cart and no write is lost.
 * `fn` runs again on a fresh read after a lost race; it must be pure. When `fn` returns the array
 * it was given nothing is written (a refused or no-op change). A missing cart is inserted with
 * `rev: 1`; an E11000 from two racing inserts counts as a lost race. After `MAX_ATTEMPTS` lost races this
 * throws `HttpError(409, "cart_conflict")` (`maxAttempts` exists so a test can reach that cheaply).
 */
export async function mutateCart(
  userId: ObjectId,
  now: Date,
  fn: (lines: readonly CartLine[]) => CartMutation,
  maxAttempts: number = MAX_ATTEMPTS,
): Promise<{ lines: CartLine[]; blocked: CartBlock | null; trimmed: boolean }> {
  const col = await carts();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const doc = await col.findOne({ _id: userId });
    const before: readonly CartLine[] = doc?.lines ?? [];
    const out = fn(before);
    const result = {
      lines: [...out.lines],
      blocked: out.blocked ?? null,
      trimmed: out.trimmed ?? false,
    };
    if (out.lines === before) return result;
    if (!doc) {
      try {
        await col.insertOne({
          _id: userId,
          lines: result.lines,
          rev: 1,
          createdAt: now,
          updatedAt: now,
        });
        return result;
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
        await new Promise((r) => setTimeout(r, Math.random() * BACKOFF_MS));
        continue;
      }
    }
    const res = await col.updateOne(
      { _id: userId, rev: doc.rev },
      { $set: { lines: result.lines, updatedAt: now }, $inc: { rev: 1 } },
    );
    if (res.modifiedCount === 1) return result;
    // A little jitter spreads the losers out instead of having them collide again in lockstep.
    await new Promise((r) => setTimeout(r, Math.random() * BACKOFF_MS));
  }
  throw new HttpError(409, "cart_conflict");
}
