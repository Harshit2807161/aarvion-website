import { orderForShelf } from "@/server/catalogue/order";
import type { PublicProduct } from "@/server/catalogue/queries";
import type { Category, CategorySlug } from "@/server/catalogue/schema";
import { shortName } from "./display";

// What the home page's "Shop by category" bento needs, computed from the cached catalogue reads.
// Pure and client-safe: only `catalogue/order` is imported at runtime from src/server.

export type HomeModel = {
  /** The live categories that have products, in sortOrder, each in shelf order. */
  groups: { category: Category; products: PublicProduct[] }[];
  /** Categories marked coming soon, in sortOrder. */
  comingSoon: Category[];
  /** Every product in the live groups. */
  total: number;
  /** True when every product needs a prescription (the home's note may then say "All N"). */
  allRx: boolean;
};

export function homeModel(products: PublicProduct[], categories: readonly Category[]): HomeModel {
  const bySort = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const live = bySort.filter((c) => c.status === "live");
  const shelf = orderForShelf(products, live);
  const groups = live
    .map((category) => ({ category, products: shelf.filter((p) => p.category === category.slug) }))
    .filter((g) => g.products.length > 0);
  const all = groups.flatMap((g) => g.products);
  return {
    groups,
    comingSoon: bySort.filter((c) => c.status === "coming_soon"),
    total: all.length,
    allRx: all.every((p) => p.rxRequired),
  };
}

/**
 * Which grid cell each category takes and which products draw its art (slugs, back to front).
 * The key order is the tile order. The classes are the cells in src/styles/bento.css.
 */
export const BENTO_LAYOUT = {
  cardiology: { tile: "tile-cardio", art: ["bemptor-r40", "sacuwin-200", "sacuwin-100"] },
  ophthalmology: { tile: "tile-eye", art: ["sysnet-ultra", "oloage-kt", "caftop"] },
  diabetology: { tile: "tile-diab", art: ["vildage-m-50-500"] },
  respiratory: { tile: "tile-resp", art: ["mucohelp"] },
} as const satisfies Partial<Record<CategorySlug, { tile: string; art: readonly string[] }>>;

export type BentoTile = {
  category: Category;
  tile: string;
  art: PublicProduct[];
  /** Products in the category (the tile's "5 medicines"). */
  count: number;
  list: string;
};

/**
 * [C26] The tiles: BENTO_LAYOUT's categories in its key order, then any other live category by
 * sortOrder as a plain `tile-diab` cell with no art. Art slugs missing from the group are skipped.
 */
export function bentoTiles(model: HomeModel): BentoTile[] {
  const layout: Record<string, { tile: string; art: readonly string[] } | undefined> = BENTO_LAYOUT;
  const known = Object.keys(BENTO_LAYOUT);
  const rank = (slug: string) => {
    const i = known.indexOf(slug);
    return i === -1 ? known.length : i;
  };
  return model.groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => rank(a.g.category.slug) - rank(b.g.category.slug) || a.i - b.i)
    .map(({ g: { category, products } }) => {
      const spec = layout[category.slug];
      const art = (spec?.art ?? []).flatMap((slug) => products.find((p) => p.slug === slug) ?? []);
      return {
        category,
        tile: spec?.tile ?? "tile-diab",
        art,
        count: products.length,
        list: tileList(products),
      };
    });
}

/** "a", "a and b", "a, b and c". */
const andList = (xs: string[]) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

/** A family as one phrase: "Sacuwin 50, 100 and 200" when every name is `${base} ${variantLabel}`. */
function familyPhrase(family: PublicProduct[]): string {
  const [first] = family;
  const label = first?.variantLabel;
  const base = first && label ? first.name.slice(0, -(label.length + 1)) : "";
  const collapses =
    family.length > 1 &&
    !!base &&
    family.every((p) => p.variantLabel !== null && p.name === `${base} ${p.variantLabel}`);
  if (!collapses) return family.map((p) => shortName(p.name)).join(", ");
  return `${base} ${andList(family.map((p) => p.variantLabel!))}`;
}

/**
 * The products in shelf order, as the tile's one-line list: brand names without " Eye Drops",
 * each strength family collapsed ("Sacuwin 50, 100 and 200").
 */
export function tileList(products: PublicProduct[]): string {
  const families = Map.groupBy(products, (p) => p.familySlug);
  return [...families.values()].map(familyPhrase).join(", ");
}
