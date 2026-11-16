import type { WithId } from "mongodb";
import { getDb } from "../db/client.ts";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION } from "./collections.ts";
import { sellingPricePaise } from "./pricing.ts";
import { matchesTokens, queryTokens } from "./search.ts";
import { Slug, type Category, type Product } from "./schema.ts";

export type PublicProduct = Omit<
  Product,
  "internalNotes" | "mrpSource" | "createdAt" | "updatedAt"
> & {
  id: string;
  pricePaise: number;
};

function toPublicProduct(doc: WithId<Product>): PublicProduct {
  const { _id, ...fields } = doc;
  const pub: Partial<Product> = { ...fields };
  delete pub.internalNotes;
  delete pub.mrpSource;
  delete pub.createdAt;
  delete pub.updatedAt;
  return {
    ...(pub as Omit<Product, "internalNotes" | "mrpSource" | "createdAt" | "updatedAt">),
    id: _id.toHexString(),
    pricePaise: sellingPricePaise(doc.mrpPaise),
  };
}

async function categories() {
  const db = await getDb();
  return db.collection<Category>(CATEGORIES_COLLECTION);
}

async function products() {
  const db = await getDb();
  return db.collection<Product>(PRODUCTS_COLLECTION);
}

async function liveSlugs(): Promise<string[]> {
  const docs = await (await categories()).find({ status: "live" }).project({ slug: 1 }).toArray();
  return docs.map((d) => d.slug as string);
}

export async function listVisibleCategories(): Promise<Category[]> {
  const docs = await (
    await categories()
  )
    .find({ status: { $in: ["live", "coming_soon"] } })
    .sort({ sortOrder: 1 })
    .toArray();
  return docs.map(({ slug, name, status, sortOrder }) => ({ slug, name, status, sortOrder }));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (!Slug.safeParse(slug).success) return null;
  const doc = await (
    await categories()
  ).findOne({
    slug: slug as Category["slug"],
    status: { $in: ["live", "coming_soon"] },
  });
  return doc
    ? { slug: doc.slug, name: doc.name, status: doc.status, sortOrder: doc.sortOrder }
    : null;
}

export async function listProducts(
  opts: { category?: string; q?: string } = {},
): Promise<PublicProduct[]> {
  const live = await liveSlugs();
  if (opts.category !== undefined && !live.includes(opts.category)) return [];
  const tokens = opts.q === undefined ? null : queryTokens(opts.q);
  if (tokens && tokens.length === 0) return [];
  const docs = await (
    await products()
  )
    .find({ active: true, category: (opts.category ?? { $in: live }) as Product["category"] })
    .sort({ sortOrder: 1, name: 1 })
    .toArray();
  return docs.filter((d) => !tokens || matchesTokens(d, tokens)).map(toPublicProduct);
}

export async function getProductBySlug(slug: string): Promise<PublicProduct | null> {
  if (!Slug.safeParse(slug).success) return null;
  const live = await liveSlugs();
  const doc = await (
    await products()
  ).findOne({
    slug,
    active: true,
    category: { $in: live as Product["category"][] },
  });
  return doc ? toPublicProduct(doc) : null;
}

function variantNumber(p: { variantLabel: string | null }): number {
  const n = p.variantLabel === null ? Number.NaN : Number.parseInt(p.variantLabel, 10);
  return n;
}

export async function getFamily(familySlug: string): Promise<PublicProduct[]> {
  if (!Slug.safeParse(familySlug).success) return [];
  const live = await liveSlugs();
  const docs = await (
    await products()
  )
    .find({ familySlug, active: true, category: { $in: live as Product["category"][] } })
    .toArray();
  return docs
    .sort((a, b) => {
      const x = variantNumber(a);
      const y = variantNumber(b);
      if (Number.isNaN(x) !== Number.isNaN(y)) return Number.isNaN(x) ? 1 : -1;
      if (!Number.isNaN(x) && x !== y) return x - y;
      return a.name.localeCompare(b.name);
    })
    .map(toPublicProduct);
}
