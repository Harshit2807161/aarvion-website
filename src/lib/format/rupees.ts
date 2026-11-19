const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Integer paise to a rupee string with Indian digit grouping: 117900 -> "₹1,179",
 * 10000000 -> "₹1,00,000". Two decimals appear only when there are paise: 38750 -> "₹387.50".
 * Money is integer paise everywhere; anything else is a bug, so it throws.
 */
export function formatRupees(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new RangeError(`formatRupees needs a non-negative safe integer of paise, got ${paise}`);
  }
  const whole = Math.trunc(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? `₹${inr.format(whole)}` : `₹${inrExact.format(paise / 100)}`;
}
