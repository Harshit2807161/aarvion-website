import type { WithId } from "mongodb";
import { getDb } from "../db/client.ts";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION } from "./collections.ts";
import { compareVariants } from "./order.ts";
import { sellingPricePaise } from "./pricing.ts";
import { matchesTokens, queryTokens } from "./search.ts";
import { Slug, type Category, type Product, type ProductImage } from "./schema.ts";

export type PublicProduct = Omit<
  Product,
  "internalNotes" | "mrpSource" | "createdAt" | "updatedAt"
> & {
  id: string;
  pricePaise: number;
};

export function toPublicProduct(doc: WithId<Product>): PublicProduct {
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
  const parsed = Slug.safeParse(slug);
  if (!parsed.success) return null;
  const doc = await (
    await categories()
  ).findOne({
    slug: parsed.data as Category["slug"],
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
  const parsed = Slug.safeParse(slug);
  if (!parsed.success) return null;
  const live = await liveSlugs();
  const doc = await (
    await products()
  ).findOne({
    slug: parsed.data,
    active: true,
    category: { $in: live as Product["category"][] },
  });
  return doc ? toPublicProduct(doc) : null;
}

export async function getFamily(familySlug: string): Promise<PublicProduct[]> {
  const parsed = Slug.safeParse(familySlug);
  if (!parsed.success) return [];
  const live = await liveSlugs();
  const docs = await (
    await products()
  )
    .find({
      familySlug: parsed.data,
      active: true,
      category: { $in: live as Product["category"][] },
    })
    .toArray();
  return docs.sort(compareVariants).map(toPublicProduct);
}

/** What a cart line shows: the product facts, its current MRP and one image. */
export type PurchasableProduct = Pick<
  PublicProduct,
  "slug" | "name" | "packLabel" | "dosageForm" | "composition" | "rxRequired" | "mrpPaise"
> & { image: ProductImage };

const MAX_PURCHASABLE_LOOKUP = 20;

/**
 * The products among `slugs` that can be bought right now: `active` and in a live category.
 * A direct Mongo read, never cached, because cart prices must follow the current MRP. Slugs that
 * are not valid slugs are ignored (they only ever reach Mongo as parsed strings); more than 20
 * distinct slugs throws RangeError, since a cart holds at most 20 lines.
 */
export async function getPurchasableBySlugs(
  slugs: readonly string[],
): Promise<Map<string, PurchasableProduct>> {
  const valid = [
    ...new Set(slugs.flatMap((s) => (Slug.safeParse(s).success ? [s as Product["slug"]] : []))),
  ];
  if (valid.length > MAX_PURCHASABLE_LOOKUP) {
    throw new RangeError(`at most ${MAX_PURCHASABLE_LOOKUP} slugs per lookup`);
  }
  const out = new Map<string, PurchasableProduct>();
  if (valid.length === 0) return out;
  const live = await liveSlugs();
  const docs = await (
    await products()
  )
    .find({ slug: { $in: valid }, active: true, category: { $in: live as Product["category"][] } })
    .toArray();
  for (const d of docs) {
    out.set(d.slug, {
      slug: d.slug,
      name: d.name,
      packLabel: d.packLabel,
      dosageForm: d.dosageForm,
      composition: d.composition,
      rxRequired: d.rxRequired,
      mrpPaise: d.mrpPaise,
      image: d.cutout ?? d.images[0]!,
    });
  }
  return out;
}
