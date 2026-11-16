/** Prescription validity. Pure, no I/O. All calendar maths is on the Asia/Kolkata wall clock. */

export const RX_VALIDITY_MONTHS = 6;

/** Asia/Kolkata is UTC+05:30 all year (no DST). */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Adds calendar months on the IST wall clock, clamping the day to the target
 * month's last day (31 Aug + 6 months = 28 Feb, or 29 Feb in a leap year).
 * The time of day is preserved. Returns an instant.
 */
export function addCalendarMonthsIst(date: Date, months: number): Date {
  // Shift so that the UTC getters read IST wall-clock fields.
  const wall = new Date(date.getTime() + IST_OFFSET_MS);
  const day = wall.getUTCDate();
  const totalMonths = wall.getUTCFullYear() * 12 + wall.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const result = Date.UTC(
    year,
    month,
    Math.min(day, lastDay),
    wall.getUTCHours(),
    wall.getUTCMinutes(),
    wall.getUTCSeconds(),
    wall.getUTCMilliseconds(),
  );
  return new Date(result - IST_OFFSET_MS);
}

export type RxSnapshot = {
  status: "pending" | "approved" | "rejected";
  /** Midnight IST of the Rx's date. */
  rxDate: Date | null;
  /** Pharmacist's valid-until: an exclusive instant, capped at rxDate + 6 months. */
  validUntil: Date | null;
};

/**
 * True when the Rx is approved and `on` falls in [rxDate, min(validUntil, rxDate + 6 months)).
 * Callers judge validity at the moment of the gated transition (confirm, pack, ship).
 */
export function isRxValidOn(rx: RxSnapshot, on: Date): boolean {
  if (rx.status !== "approved" || rx.rxDate === null) return false;
  const cap = addCalendarMonthsIst(rx.rxDate, RX_VALIDITY_MONTHS).getTime();
  const end = rx.validUntil === null ? cap : Math.min(rx.validUntil.getTime(), cap);
  return rx.rxDate.getTime() <= on.getTime() && on.getTime() < end;
}
