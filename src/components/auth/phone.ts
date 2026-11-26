/** Indian mobile helpers shared by the login screens. */

/** A valid Indian mobile: ten digits starting 6-9 (the +91 and leading 0 are stripped by normMobile). */
export const MOBILE_RE = /^[6-9]\d{9}$/;

/** Deliberately loose: the server is the authority; this only catches obvious typos. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The ASCII value of a decimal digit from any script (Devanagari, fullwidth, ...). */
function digitValue(ch: string): string {
  const cp = ch.codePointAt(0)!;
  if (cp < 128) return ch;
  // Decimal digit blocks come in aligned runs of ten, so the value is the offset in the run.
  let start = cp;
  while (start > 0 && /^\p{Nd}$/u.test(String.fromCodePoint(start - 1))) start--;
  return String((cp - start) % 10);
}

/**
 * Turns what a shopper typed into the number to send. Digits of any script become ASCII digits,
 * then exactly one prefix is stripped, the same ones the server accepts: a leading "+91" or a
 * 12-digit "91...", or a leading "0" on 11 digits. It never truncates and never drops a
 * character: if the input holds anything but digits, whitespace, "-", ".", brackets and one
 * leading "+", it is returned as typed, so `MOBILE_RE` fails and a typo can never become a
 * different, valid-looking number.
 */
export function normMobile(raw: string): string {
  const s = raw.trim();
  if (!/^\+?[\p{Nd}\s\-.()]*$/u.test(s)) return s;
  const d = s.replace(/\p{Nd}/gu, digitValue).replace(/[^0-9]/g, "");
  if (s.startsWith("+") && d.startsWith("91")) return d.slice(2);
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
}

/** "9876543210" -> "+91 98765 43210". Expects ten digits. */
export function formatMobile(d: string): string {
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}
