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

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "YYYY-MM-DD" to that day's 00:00 IST instant. Throws a RangeError for a malformed or
 * impossible date ("2027-02-30"): the check round-trips through the calendar, never trusting
 * the Date constructor's overflow.
 */
export function istMidnight(ymd: string): Date {
  const m = YMD_RE.exec(ymd);
  if (!m) throw new RangeError("Invalid date: expected YYYY-MM-DD");
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = new Date(Date.UTC(y, mo - 1, da));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== da) {
    throw new RangeError("Invalid date: no such day");
  }
  return new Date(utc.getTime() - IST_OFFSET_MS);
}

/** The IST calendar day ("YYYY-MM-DD") that contains the instant `at`. */
export function istDay(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The exclusive instant the Rx stops being valid: min(validUntil, rxDate + 6 months), or null
 * when there is no rxDate. The same end `isRxValidOn` judges against.
 */
export function rxEnd(rx: Pick<RxSnapshot, "rxDate" | "validUntil">): Date | null {
  if (rx.rxDate === null) return null;
  const cap = addCalendarMonthsIst(rx.rxDate, RX_VALIDITY_MONTHS);
  return rx.validUntil === null || rx.validUntil.getTime() > cap.getTime() ? cap : rx.validUntil;
}
