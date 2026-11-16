import { registerIndexes } from "../db/indexes.ts";

export const PRODUCTS_COLLECTION = "products";
export const CATEGORIES_COLLECTION = "categories";

registerIndexes(PRODUCTS_COLLECTION, [{ key: { slug: 1 }, name: "slug_unique", unique: true }]);
registerIndexes(CATEGORIES_COLLECTION, [{ key: { slug: 1 }, name: "slug_unique", unique: true }]);
registerIndexes(PRODUCTS_COLLECTION, [
  { key: { category: 1, active: 1, sortOrder: 1 }, name: "category_active_sortOrder" },
  { key: { familySlug: 1, active: 1 }, name: "familySlug_active" },
]);
