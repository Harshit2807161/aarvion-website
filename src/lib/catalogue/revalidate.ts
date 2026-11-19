import { revalidateTag } from "next/cache";
import { CATALOGUE_TAG } from "./tags";

/**
 * Expire every cached catalogue read now: `expire: 0` serves no stale data, so the next
 * request re-reads Mongo (prices must never lag an edit). Every catalogue write calls it.
 */
export function revalidateCatalogue(): void {
  revalidateTag(CATALOGUE_TAG, { expire: 0 });
}
