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
import type { Category } from "@/server/catalogue/schema";
import { CATALOGUE_TAG, categoryTag, familyTag, productTag } from "./tags";

// Pages read the catalogue only through these. "hours" is a backstop: catalogue writes
// expire the tag at once through revalidateCatalogue().

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
  cacheTag(CATALOGUE_TAG, categoryTag(slug));
  return getCategoryBySlug(slug);
}

export async function getCachedProduct(slug: string): Promise<PublicProduct | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG, productTag(slug));
  return getProductBySlug(slug);
}

/** A family's public variants, in compareVariants order. */
export async function getCachedFamily(familySlug: string): Promise<PublicProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG, familyTag(familySlug));
  return getFamily(familySlug);
}
