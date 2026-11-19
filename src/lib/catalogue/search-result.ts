import { matchesTokens, queryTokens } from "@/server/catalogue/search";
import { sellingPricePaise } from "@/server/catalogue/pricing";
import type { PublicProduct } from "@/server/catalogue/queries";
import type { ProductImage } from "@/server/catalogue/schema";
import {
  fullComposition,
  strengthTokens,
  packDisplay,
  pocketImage,
  type PocketProduct,
} from "./display";

/** What the header search shows per hit. Deliberately small: no raw composition, no notes. */
export type SearchResult = {
  slug: string;
  name: string;
  /** The whole composition as printed (fullComposition). */
  salt: string;
  /** The pack line (packDisplay). */
  pack: string;
  mrpPaise: number;
  pricePaise: number;
  image: ProductImage | null;
};

/** Builds one search hit; the selling price always comes from sellingPricePaise. */
export function toSearchResult(p: PocketProduct | PublicProduct): SearchResult {
  return {
    slug: p.slug,
    name: p.name,
    salt: fullComposition(p.composition),
    pack: packDisplay(p),
    mrpPaise: p.mrpPaise,
    pricePaise: sellingPricePaise(p.mrpPaise),
    image: pocketImage(p),
  };
}

export const SEARCH_LIMIT = { limit: 60, windowMs: 60_000 } as const;
export const MAX_RESULTS = 20;
export const STRENGTH_RE = /^\d{1,6}$/;

/**
 * The search filter, pure: products (already in shelf order) whose name, family or composition
 * match every query token and, when `strength` is given, whose variant label has it as a whole
 * number ("5" does not match "50"). No query and no strength give no hits. At most MAX_RESULTS.
 */
export function searchProducts(
  products: PublicProduct[],
  q: string,
  strength: string | null,
): SearchResult[] {
  const tokens = queryTokens(q);
  if (tokens.length === 0 && strength === null) return [];
  return products
    .filter(
      (p) =>
        matchesTokens(p, tokens) &&
        (strength === null || strengthTokens(p.variantLabel).includes(strength)),
    )
    .slice(0, MAX_RESULTS)
    .map(toSearchResult);
}
