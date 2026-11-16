import type { AnyBulkWriteOperation, Db } from "mongodb";
import type { ImageManifest } from "../../../scripts/sync-product-images.ts";
import { CATEGORIES_COLLECTION, PRODUCTS_COLLECTION } from "./collections.ts";
import type { Category, Product, ProductJson } from "./schema.ts";

export function toProductDoc(
  p: ProductJson,
  images: ImageManifest[string],
  defaultMrpPaise: number,
  now: Date,
): Product {
  const hero = images.photos.find((ph) => ph.from === p.heroImage);
  if (!hero) throw new Error(`${p.slug}: hero image ${p.heroImage} is not in the image manifest`);
  const ordered = [hero, ...images.photos.filter((ph) => ph !== hero)];
  const { notes, mrpPaise, ...rest } = p;
  return {
    ...rest,
    mrpPaise: mrpPaise ?? defaultMrpPaise,
    mrpSource: mrpPaise === null ? "default" : p.mrpSource,
    images: ordered.map((ph, i) => ({
      src: ph.src,
      width: ph.width,
      height: ph.height,
      alt: `${p.name} pack, photo ${i + 1} of ${ordered.length}`,
    })),
    cutout: images.cutout
      ? {
          src: images.cutout.src,
          width: images.cutout.width,
          height: images.cutout.height,
          alt: `${p.name} pack`,
        }
      : null,
    internalNotes: notes,
    createdAt: now,
    updatedAt: now,
  };
}

export type SeedReport = {
  categories: { inserted: number; existing: number };
  products: { inserted: number; existing: number };
};

async function insertOnly(
  db: Db,
  collection: string,
  docs: readonly { slug: string }[],
): Promise<{ inserted: number; existing: number }> {
  if (docs.length === 0) return { inserted: 0, existing: 0 };
  const ops: AnyBulkWriteOperation[] = docs.map((doc) => ({
    updateOne: { filter: { slug: doc.slug }, update: { $setOnInsert: doc }, upsert: true },
  }));
  const res = await db.collection(collection).bulkWrite(ops, { ordered: false });
  return { inserted: res.upsertedCount, existing: res.matchedCount };
}

/** Insert-only: existing documents (and any admin edits to them) are never modified. */
export async function seedCatalogue(
  db: Db,
  input: { categories: readonly Category[]; products: Product[] },
  // Documents carry their own timestamps (see toProductDoc); kept for a stable signature.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _now: Date,
): Promise<SeedReport> {
  return {
    categories: await insertOnly(db, CATEGORIES_COLLECTION, input.categories),
    products: await insertOnly(db, PRODUCTS_COLLECTION, input.products),
  };
}
