/**
 * Claims the store must never make (PRODUCT.md "Evidence on Hand", AGENTS.md "Content", the UI
 * plan's "No invented claims"): licences and certifications, guarantees, cure claims, ratings,
 * reviews, customer or order counts, "bestseller", "trending" and therapy-area wording. The legal
 * page tests run `findClaims` over their rendered text and expect `[]`; each page or section task
 * adds the call to its own tests as it lands.
 *
 * The review patterns are narrow on purpose: "Under review" is a real prescription status. The
 * guarantee pattern lets a negated disclaimer through ("we do not guarantee", "cannot guarantee").
 *
 * It reads only the text it is given, so alt, aria-label and metadata strings need their own call.
 */
export const BANNED_CLAIMS: RegExp[] = [
  /licensed/i,
  /certified/i,
  /(?<!\b(?:do|does|did|can|could|will|would)\s+not\s+|\b(?:do|does|did|ca|could|wo|would)n['’]t\s+|\bcannot\s+)guarantee/i,
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

/**
 * Copy that says every listed medicine needs a prescription [C25]. That is true only while the
 * catalogue is all-Rx, so a shopper may read it only where the page computes it from data
 * (`allRx`); otherwise state the rule ("a medicine that needs a prescription is sold only
 * against a valid prescription").
 */
export const RX_UNIVERSAL_CLAIMS: RegExp[] = [
  /\b(?:every|all|each)(?:\s+(?:of|our|the|its|these|listed|current|currently|available|aarvion(?:['’]s)?))*\s+(?:medicines?|products?|packs?)\b[^.]{0,60}?\b(?:prescriptions?|rx|schedule\s+h1?)\b/i,
  /\bcurrently listed\b/i,
  /\b(?:medicines|products)\b[^.]{0,30}?\ball\s+(?:need|require)s?\b/i,
];

/**
 * The first match of each banned pattern in `text`, in pattern order; `[]` when the copy is
 * clean. Pass `allRx: true` only when the page computed from catalogue data that every listed
 * product needs a prescription and renders its Rx-universal line from that; it skips the
 * RX_UNIVERSAL_CLAIMS check and nothing else.
 */
export function findClaims(text: string, { allRx = false }: { allRx?: boolean } = {}): string[] {
  const patterns = allRx ? BANNED_CLAIMS : [...BANNED_CLAIMS, ...RX_UNIVERSAL_CLAIMS];
  return patterns.flatMap((re) => {
    const hit = re.exec(text);
    return hit ? [hit[0]] : [];
  });
}
