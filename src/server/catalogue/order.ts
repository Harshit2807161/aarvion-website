// Pure: client components may import this module at runtime (Global Constraints), so it
// takes only types from the server modules.
import type { PublicProduct } from "./queries.ts";
import type { Category } from "./schema.ts";

type Variant = Pick<PublicProduct, "variantLabel" | "name">;

const byNumber = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1);

function variantNumber(p: Variant): number {
  return p.variantLabel === null ? Number.NaN : Number.parseInt(p.variantLabel, 10);
}

/** Variants by the leading number of their label (50 < 100 < 200); NaN and null last; then by name. */
export function compareVariants(a: Variant, b: Variant): number {
  const x = variantNumber(a);
  const y = variantNumber(b);
  if (Number.isNaN(x) !== Number.isNaN(y)) return Number.isNaN(x) ? 1 : -1;
  if (!Number.isNaN(x) && x !== y) return x - y;
  return a.name.localeCompare(b.name);
}

/**
 * Shelf order for rails, category pages and search: category `sortOrder`, then families by
 * their lowest product `sortOrder`, then `compareVariants`. Returns a new array.
 */
export function orderForShelf(
  products: PublicProduct[],
  categories: readonly Category[],
): PublicProduct[] {
  const categoryRank = new Map<string, number>(categories.map((c) => [c.slug, c.sortOrder]));
  const familyKey = (p: PublicProduct) => `${p.category}/${p.familySlug}`;
  const familyRank = new Map<string, number>();
  for (const p of products) {
    const key = familyKey(p);
    familyRank.set(key, Math.min(familyRank.get(key) ?? Infinity, p.sortOrder));
  }
  return products.toSorted(
    (a, b) =>
      byNumber(
        categoryRank.get(a.category) ?? Infinity,
        categoryRank.get(b.category) ?? Infinity,
      ) ||
      byNumber(familyRank.get(familyKey(a))!, familyRank.get(familyKey(b))!) ||
      a.familySlug.localeCompare(b.familySlug) ||
      compareVariants(a, b),
  );
}
