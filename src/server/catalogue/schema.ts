import { z } from "zod";
import { MIN_MRP_PAISE } from "./pricing.ts";

export const CATEGORY_SLUGS = [
  "cardiology",
  "diabetology",
  "ophthalmology",
  "respiratory",
  "gastroenterology",
  "orthopaedics",
  "urology",
  "pain-management",
] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const CategoryStatus = z.enum(["live", "coming_soon", "hidden"]);
export type CategoryStatus = z.infer<typeof CategoryStatus>;

export const Category = z.object({
  slug: z.enum(CATEGORY_SLUGS),
  name: z.string().min(1),
  status: CategoryStatus,
  sortOrder: z.number().int(),
});
export type Category = z.infer<typeof Category>;

export const Slug = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type Slug = z.infer<typeof Slug>;

export const CompositionItem = z.object({
  ingredient: z.string().min(1),
  strength: z.string().min(1),
});
export type CompositionItem = z.infer<typeof CompositionItem>;

export const ProductImage = z.object({
  src: z.string().regex(/^\/products\/[a-z0-9-]+\/(cutout-)?[0-9a-f]{8}\.webp$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().min(1),
});
export type ProductImage = z.infer<typeof ProductImage>;

export const ImageSource = z.enum(["aarvion", "win2age", "unbranded", "placeholder"]);
export type ImageSource = z.infer<typeof ImageSource>;

export const Schedule = z.enum(["H", "H1", "G", "OTC"]);
export type Schedule = z.infer<typeof Schedule>;

const mrp = z.number().int().min(MIN_MRP_PAISE);
const rxRule = (p: { schedule: Schedule; rxRequired: boolean }) =>
  !(p.schedule === "H" || p.schedule === "H1") || p.rxRequired;
const rxMessage = "Schedule H and H1 products require a prescription";

/** One entry of data/products.json. */
export const ProductJson = z
  .strictObject({
    slug: Slug,
    name: z.string().min(1),
    familySlug: Slug,
    variantLabel: z.string().nullable(),
    category: z.enum(CATEGORY_SLUGS),
    composition: z.array(CompositionItem).min(1),
    dosageForm: z.string().min(1),
    packLabel: z.string().min(1),
    mrpPaise: mrp.nullable(),
    mrpSource: z.enum(["pack-back-panel", "default"]),
    schedule: Schedule,
    rxRequired: z.boolean(),
    manufacturer: z.string().nullable(),
    marketer: z.string().min(1),
    images: z.array(z.string().min(1)).min(1),
    heroImage: z.string().min(1),
    imageSource: ImageSource,
    active: z.boolean(),
    sortOrder: z.number().int(),
    notes: z.string().nullable(),
  })
  .refine((p) => p.images.includes(p.heroImage), {
    message: "heroImage must be one of images",
    path: ["heroImage"],
  })
  .refine(rxRule, { message: rxMessage, path: ["rxRequired"] });
export type ProductJson = z.infer<typeof ProductJson>;

export const CatalogueJson = z
  .strictObject({
    _comment: z.string().optional(),
    defaultMrpPaise: z.literal(40400),
    products: z.array(ProductJson),
  })
  .refine((c) => new Set(c.products.map((p) => p.slug)).size === c.products.length, {
    message: "product slugs must be unique",
    path: ["products"],
  });
export type CatalogueJson = z.infer<typeof CatalogueJson>;

/** The products collection document. */
export const Product = z
  .object({
    slug: Slug,
    name: z.string().min(1),
    familySlug: Slug,
    variantLabel: z.string().nullable(),
    category: z.enum(CATEGORY_SLUGS),
    composition: z.array(CompositionItem).min(1),
    dosageForm: z.string().min(1),
    packLabel: z.string().min(1),
    mrpPaise: mrp,
    mrpSource: z.enum(["pack-back-panel", "default", "admin"]),
    schedule: Schedule,
    rxRequired: z.boolean(),
    manufacturer: z.string().nullable(),
    marketer: z.string().min(1),
    images: z.array(ProductImage).min(1),
    cutout: ProductImage.nullable(),
    imageSource: ImageSource,
    active: z.boolean(),
    sortOrder: z.number().int(),
    internalNotes: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .refine(rxRule, { message: rxMessage, path: ["rxRequired"] });
export type Product = z.infer<typeof Product>;
