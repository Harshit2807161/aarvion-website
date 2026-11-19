const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/**
 * Integer paise to a rupee string with Indian digit grouping: 117900 -> "₹1,179",
 * 10000000 -> "₹1,00,000". Two decimals appear only when there are paise: 38750 -> "₹387.50".
 * Anything but a non-negative safe integer is a bug and throws. bigint keeps the split exact.
 */
export function formatRupees(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new RangeError(`formatRupees needs a non-negative safe integer of paise, got ${paise}`);
  }
  const total = BigInt(paise);
  const rupees = grouped.format(total / 100n);
  const rest = total % 100n;
  return rest === 0n ? `₹${rupees}` : `₹${rupees}.${String(rest).padStart(2, "0")}`;
}
