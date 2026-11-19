import type { PublicProduct } from "@/server/catalogue/queries";
import type { CompositionItem, ProductImage } from "@/server/catalogue/schema";

// How the storefront words catalogue data: pure string helpers, ported from the v2 prototype's
// design/prototype/src/build.mjs. Client-safe: only type imports from src/server.

/** U+00A0: keeps a quantity on one line with its unit ("26 mg", "14 tablets"). */
const NBSP = " ";

/** The fields a foil pocket (product card) reads. */
export type PocketProduct = Pick<
  PublicProduct,
  | "slug"
  | "name"
  | "composition"
  | "packLabel"
  | "dosageForm"
  | "mrpPaise"
  | "rxRequired"
  | "cutout"
  | "images"
>;

/** The whole composition as printed: "Sacubitril (as sodium) 24 mg + Valsartan 26 mg". */
export function fullComposition(c: CompositionItem[]): string {
  return c.map(({ ingredient, strength }) => `${ingredient} ${strength}`).join(" + ");
}

/**
 * The actives a card shows: preservatives dropped, the salt form "(as sodium)" stripped, and each
 * strength kept whole on one line, so a wrap or the line clamp can never cut it. The full
 * composition (fullComposition) stays in the title and for assistive tech.
 */
export function actives(c: CompositionItem[]): { name: string; strength: string }[] {
  return c
    .filter(({ ingredient }) => !/preservative/i.test(ingredient))
    .map(({ ingredient, strength }) => ({
      name: ingredient.replace(/\s*\(.*?\)/g, ""),
      strength: strength.replace(/ /g, NBSP),
    }));
}

/** The pack line: eye drops name their bottle ("10 ml bottle"); a number keeps its unit. */
export function packDisplay(p: Pick<PublicProduct, "packLabel" | "dosageForm">): string {
  const pack = p.dosageForm === "Eye drops" ? `${p.packLabel} bottle` : p.packLabel;
  return pack.replace(/(\d) (?=[A-Za-zµ%])/g, `$1${NBSP}`);
}

/** The runs of digits in a variant label: "R40" gives ["40"], "50/500" gives ["50", "500"]. */
export function strengthTokens(variantLabel: string | null): string[] {
  return variantLabel?.match(/\d+/g) ?? [];
}

/** The brand without its form: "Hyloage Eye Drops" gives "Hyloage". */
export function shortName(name: string): string {
  return name.replace(/ Eye Drops$/, "");
}

/** "1 medicine", "5 medicines". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const COUNT_WORDS = (
  "One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen " +
  "Sixteen Seventeen Eighteen Nineteen Twenty"
).split(" ");

/** A count as a capitalised word from One to Twenty, else digits. */
export function countWord(n: number): string {
  return (Number.isInteger(n) && COUNT_WORDS[n - 1]) || String(n);
}

/** The pocket's picture: the background-free cutout, else the first photo. */
export function pocketImage(p: Pick<PublicProduct, "cutout" | "images">): ProductImage {
  // The schema requires at least one photo (Product.images is min(1)).
  return p.cutout ?? p.images[0]!;
}

/** A category name as an anchor id: "Heart care" gives "heart-care". */
export function categoryAnchor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
