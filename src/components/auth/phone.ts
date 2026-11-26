/** Indian mobile helpers shared by the login screens. */

/** A valid Indian mobile: ten digits starting 6-9 (the +91 and leading 0 are stripped by normMobile). */
export const MOBILE_RE = /^[6-9]\d{9}$/;

/** Deliberately loose: the server is the authority; this only catches obvious typos. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Keeps digits only, then strips exactly one prefix, the same ones the server accepts: a leading
 * "+91" or a 12-digit "91...", or a leading "0" on 11 digits. It never truncates: anything that
 * is not exactly ten digits afterwards fails `MOBILE_RE`, so a typo can never become a different,
 * valid-looking number.
 */
export function normMobile(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && d.startsWith("91")) return d.slice(2);
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
}

/** "9876543210" -> "+91 98765 43210". Expects ten digits. */
export function formatMobile(d: string): string {
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}
