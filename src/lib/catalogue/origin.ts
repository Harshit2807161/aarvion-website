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

/** An Indian PIN code: six digits, the first not zero, standing alone. */
const PIN_CODE = /\b[1-9]\d{5}\b/;

/** "India" when the address has a PIN code or an Indian marker; null when unknown or unplaceable. */
export function countryOfOrigin(manufacturer: string | null): "India" | null {
  if (manufacturer === null) return null;
  if (PIN_CODE.test(manufacturer)) return "India";
  return INDIAN_ADDRESS_MARKERS.some((m) => manufacturer.includes(m)) ? "India" : null;
}
