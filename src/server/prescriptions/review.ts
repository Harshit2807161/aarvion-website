import { z } from "zod";

// Pure: no I/O, no clock (callers pass `at`), and type-only imports from other modules, so the
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
