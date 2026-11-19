import { sellingPricePaise } from "@/server/catalogue/pricing";
import type { PublicProduct } from "@/server/catalogue/queries";
import type { ProductImage } from "@/server/catalogue/schema";
import { fullComposition, packDisplay, pocketImage, type PocketProduct } from "./display";

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
