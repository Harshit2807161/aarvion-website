import { strengthTokens } from "@/lib/catalogue/display";
import { STRENGTH_RE } from "@/lib/catalogue/search-result";

/** The family whose strengths the header search offers as chips (50, 100, 200), as in the prototype. */
export const STRENGTH_CHIP_FAMILY = "sacuwin";

/**
 * The chip labels for a family's variants (already in variant order): the digit runs of each
 * variant label, deduplicated, and only values the API accepts as a strength. An empty family
 * (it was removed from the catalogue) gives no chips, and the header shows none.
 */
export function strengthChips(variants: { variantLabel: string | null }[]): string[] {
  const out: string[] = [];
  for (const v of variants) {
    for (const t of strengthTokens(v.variantLabel)) {
      if (STRENGTH_RE.test(t) && !out.includes(t)) out.push(t);
    }
  }
  return out;
}
