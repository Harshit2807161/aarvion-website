/** Indian mobile helpers shared by the login screens. */

/** A valid Indian mobile: ten digits starting 6-9 (the +91 and leading 0 are stripped by normMobile). */
export const MOBILE_RE = /^[6-9]\d{9}$/;

/** Deliberately loose: the server is the authority; this only catches obvious typos. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Keeps digits only, drops a leading "91" or "0" when more than 10 digits remain (so a pasted
 * "+91 ..." or "0..." works), then keeps the first 10.
 */
export function normMobile(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length > 10) {
    if (d.startsWith("91")) d = d.slice(2);
    else if (d.startsWith("0")) d = d.slice(1);
  }
  return d.slice(0, 10);
}

/** "9876543210" -> "+91 98765 43210". Expects ten digits. */
export function formatMobile(d: string): string {
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}
