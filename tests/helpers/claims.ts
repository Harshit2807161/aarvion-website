/**
 * Claims the store must never make (PRODUCT.md "Evidence on Hand", AGENTS.md "Content", the UI
 * plan's "No invented claims"): licences and certifications, guarantees, cure claims, ratings,
 * reviews, customer or order counts, "bestseller", "trending" and therapy-area wording. Page and
 * section tests run `findClaims` over their rendered text and expect `[]`.
 *
 * The review patterns are narrow on purpose: "Under review" is a real prescription status.
 */
export const BANNED_CLAIMS: RegExp[] = [
  /licensed/i,
  /certified/i,
  /guarantee/i,
  /\b100%/,
  /best price/i,
  /\bcures?\b/i,
  /trusted by/i,
  /\b\d[\d,]*\+?\s+(customers|orders|patients)\b/i,
  /\brated\b/i,
  /\bcustomer reviews?\b/i,
  /\b\d+\s+reviews?\b/i,
  /bestseller/i,
  /trending/i,
  /therapy area/i,
];

/** The first match of each banned pattern in `text`, in pattern order; `[]` when the copy is clean. */
export function findClaims(text: string): string[] {
  return BANNED_CLAIMS.flatMap((re) => {
    const hit = re.exec(text);
    return hit ? [hit[0]] : [];
  });
}
