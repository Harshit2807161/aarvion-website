import { z } from "zod";
import { addCalendarMonthsIst, istDay, istMidnight, RX_VALIDITY_MONTHS } from "./validity.ts";

// Pure: no I/O, no clock (callers pass `at`), and one runtime import (`validity.ts`, also pure), so the
// rules can be unit tested and a client could import the view types. Writes and audit rows
// belong to the service (R4); nothing here logs, and no patient data leaves a return value.

export const RX_STATUSES = ["pending", "approved", "rejected"] as const;
export type RxStatus = (typeof RX_STATUSES)[number];

export const RX_REJECT_REASONS = [
  "unreadable",
  "outdated",
  "incomplete",
  "patient_mismatch",
  "not_prescription",
  "other",
] as const;
export type RxRejectReason = (typeof RX_REJECT_REASONS)[number];

/** What the customer ticks when uploading. Bump the version when the text changes. */
export const RX_DECLARATION_VERSION = "2026-11-27";
export const RX_DECLARATION_TEXT =
  "This is a valid prescription from a registered doctor, written for the patient named above.";

export type RxReview =
  | { kind: "approved"; by: string; at: Date; doctorName: string; doctorRegNo: string }
  | {
      kind: "rejected";
      by: string;
      at: Date;
      reason: RxRejectReason;
      note: string | null;
      revoked: boolean;
    };

/**
 * A person's name, as the sign-up rule has it (src/server/auth/login.ts): at least one letter,
 * and no control, format or default-ignorable character, except a zero-width (non-)joiner
 * between letters or marks. Inlined here; R4 re-points it to the shared PersonName.
 */
const NO_HIDDEN_CHARS =
  /^(?:[^\p{C}\p{Default_Ignorable_Code_Point}]|(?<=[\p{L}\p{M}])[\u200C\u200D](?=[\p{L}\p{M}]))*$/u;
const PersonName = z.string().trim().min(2).max(80).regex(/\p{L}/u).regex(NO_HIDDEN_CHARS);

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const RxApproveInput = z.strictObject({
  doctorName: PersonName,
  doctorRegNo: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9./ -]+$/),
  rxDate: YMD,
  /** The last day the Rx may be used (inclusive); absent means the six month cap. */
  validUntil: YMD.optional(),
});
export type RxApproveInput = z.infer<typeof RxApproveInput>;

export const RxRejectInput = z.strictObject({
  reason: z.enum(RX_REJECT_REASONS),
  note: z.string().trim().min(1).max(500).optional(),
});
export type RxRejectInput = z.infer<typeof RxRejectInput>;

/**
 * The fields a review writes on the prescription document. An approval sets both dates (the
 * stored `validUntil` is never null); a rejection or revoke sets neither, so a `$set` of it
 * leaves an approved Rx's dates as they were, "kept for the record". The `?: never` fields make
 * a reject set that carries dates, or an approve set without them, a compile error.
 */
export type RxReviewSet =
  | {
      status: "approved";
      review: Extract<RxReview, { kind: "approved" }>;
      rxDate: Date;
      validUntil: Date;
    }
  | {
      status: "rejected";
      review: Extract<RxReview, { kind: "rejected" }>;
      rxDate?: never;
      validUntil?: never;
    };

export type RxReviewError =
  | "not_pending"
  | "final"
  | "invalid_transition"
  | "rx_date_in_future"
  | "rx_outdated"
  | "valid_until_out_of_range"
  | "invalid_date";

export type RxReviewAction =
  { type: "approve"; input: RxApproveInput } | { type: "reject"; input: RxRejectInput };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The pharmacist's decision as a state change. Approve only from `pending`; reject from
 * `pending` or from `approved` (a revoke, `revoked: true`, which keeps `rxDate` and
 * `validUntil` for the record); `rejected` is final. The caller applies `set` with a
 * conditional update on `{ _id, status: from }`.
 *
 * Approve rules, all on IST days: `rxDate` is not after today; `at` is before rxDate + 6
 * calendar months; the stored `validUntil` is the instant after the last valid day (so a day
 * entry is inclusive), must be after `rxDate` and not past the six month cap, and defaults to
 * the cap.
 */
export function reviewRx(
  rx: { status: RxStatus },
  action: RxReviewAction,
  ctx: { at: Date; by: string },
): { ok: true; from: RxStatus; set: RxReviewSet } | { ok: false; error: RxReviewError } {
  if (rx.status === "rejected") return { ok: false, error: "final" };
  // Fail closed on a status this module does not know (corrupt data): never a `from` to match.
  if (rx.status !== "pending" && rx.status !== "approved") {
    return { ok: false, error: "invalid_transition" };
  }

  if (action.type === "reject") {
    const { reason, note } = action.input;
    return {
      ok: true,
      from: rx.status,
      set: {
        status: "rejected",
        review: {
          kind: "rejected",
          by: ctx.by,
          at: ctx.at,
          reason,
          note: note ?? null,
          revoked: rx.status === "approved",
        },
      },
    };
  }

  if (rx.status !== "pending") return { ok: false, error: "not_pending" };
  const { doctorName, doctorRegNo, rxDate: rxDay, validUntil: lastDay } = action.input;

  let rxDate: Date;
  let end: Date | null = null;
  try {
    rxDate = istMidnight(rxDay);
    if (lastDay !== undefined) end = new Date(istMidnight(lastDay).getTime() + DAY_MS); // IST has no DST
  } catch (e) {
    if (e instanceof RangeError) return { ok: false, error: "invalid_date" };
    throw e;
  }
  if (rxDay > istDay(ctx.at)) return { ok: false, error: "rx_date_in_future" };
  const cap = addCalendarMonthsIst(rxDate, RX_VALIDITY_MONTHS);
  if (ctx.at.getTime() >= cap.getTime()) return { ok: false, error: "rx_outdated" };
  // A valid-until already past would approve an Rx that is expired on arrival.
  const earliest = Math.max(rxDate.getTime(), ctx.at.getTime());
  if (end !== null && (end.getTime() <= earliest || end.getTime() > cap.getTime())) {
    return { ok: false, error: "valid_until_out_of_range" };
  }
  return {
    ok: true,
    from: "pending",
    set: {
      status: "approved",
      review: { kind: "approved", by: ctx.by, at: ctx.at, doctorName, doctorRegNo },
      rxDate,
      validUntil: end ?? cap,
    },
  };
}
