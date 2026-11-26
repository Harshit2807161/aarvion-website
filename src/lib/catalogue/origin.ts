/**
 * Country of origin, derived only from the manufacturer's printed address (the Legal Metrology
 * declaration). Pure and client-safe. It never guesses: an address it cannot place gives null,
 * and the product page then shows "To be added".
 */

/** Place names and state codes that mark an Indian address when it carries no PIN code. */
export const INDIAN_ADDRESS_MARKERS = [
  "Haridwar",
  "Uttarakhand",
  "(HP)",
  "Himachal",
  "(Pb.)",
  "Punjab",
  "Delhi",
] as const;

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Each marker as a whole word in any case ("HARIDWAR" counts), and not a street name:
 * "Delhi Street, London" names a street, not the place of manufacture.
 */
const MARKER_PATTERNS = INDIAN_ADDRESS_MARKERS.map(
  (m) =>
    new RegExp(
      `(?<![\\p{L}\\d])${escape(m)}(?![\\p{L}\\d])(?!\\s+(?:street|st|road|rd|lane|avenue|ave|drive|way|square)(?![\\p{L}\\d]))`,
      "iu",
    ),
);

/**
 * "India" only when the address names an Indian place from INDIAN_ADDRESS_MARKERS; null when the
 * manufacturer is unknown or the address cannot be placed. A PIN-shaped number alone is not
 * enough: six-digit postcodes and plot numbers exist outside India, so a wrong "India" on a
 * legal declaration is worse than "To be added". Extend the marker list for a new state.
 */
export function countryOfOrigin(manufacturer: string | null): "India" | null {
  if (manufacturer === null) return null;
  return MARKER_PATTERNS.some((re) => re.test(manufacturer)) ? "India" : null;
}
