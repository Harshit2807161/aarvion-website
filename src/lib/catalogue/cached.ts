import { cacheLife, cacheTag } from "next/cache";
import { orderForShelf } from "@/server/catalogue/order";
import {
  getCategoryBySlug,
  getFamily,
  getProductBySlug,
  listProducts,
  listVisibleCategories,
  type PublicProduct,
} from "@/server/catalogue/queries";
import { Slug, type Category } from "@/server/catalogue/schema";
import { CATALOGUE_TAG, categoryTag, familyTag, productTag } from "./tags";

// Pages read the catalogue only through these. "hours" is a backstop: catalogue writes
// expire the tag at once through revalidateCatalogue().

/** The per-slug tag, only for a valid slug: Next logs a rejected (over-long) tag verbatim. */
const slugTag = (slug: string, tag: (slug: string) => string): string[] =>
  Slug.safeParse(slug).success ? [tag(slug)] : [];

/** Every public product (live categories, active), in shelf order. */
export async function getCachedProducts(): Promise<PublicProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG);
  const [products, categories] = await Promise.all([listProducts(), listVisibleCategories()]);
  return orderForShelf(products, categories);
}

/** Live and coming-soon categories, in sortOrder. */
export async function getCachedCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG);
  return listVisibleCategories();
}

export async function getCachedCategory(slug: string): Promise<Category | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG, ...slugTag(slug, categoryTag));
  return getCategoryBySlug(slug);
}

export async function getCachedProduct(slug: string): Promise<PublicProduct | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG, ...slugTag(slug, productTag));
  return getProductBySlug(slug);
}

/** A family's public variants, in compareVariants order. */
export async function getCachedFamily(familySlug: string): Promise<PublicProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG, ...slugTag(familySlug, familyTag));
  return getFamily(familySlug);
}
