import { describe, expect, it } from "vitest";
import {
  RX_DECLARATION_TEXT,
  RX_DECLARATION_VERSION,
  RX_REJECT_REASONS,
  RX_STATUSES,
  RxApproveInput,
  RxRejectInput,
  reviewRx,
  type RxReviewSet,
  type RxStatus,
} from "./review";
import { istMidnight } from "./validity";

const d = (s: string) => new Date(s);
const NOW = d("2026-11-20T06:00:00Z"); // 2026-11-20 11:30 IST
const ctx = { at: NOW, by: "staff-1" };
const approve = (input: { rxDate: string; validUntil?: string }) => ({
  type: "approve" as const,
  input: { doctorName: "Dr A Sharma", doctorRegNo: "DMC/12345", ...input },
});
const reject = (reason: (typeof RX_REJECT_REASONS)[number] = "unreadable", note?: string) => ({
  type: "reject" as const,
  input: { reason, ...(note === undefined ? {} : { note }) },
});

describe("constants", () => {
  it("pins the statuses, reasons and the patient declaration", () => {
    expect(RX_STATUSES).toEqual(["pending", "approved", "rejected"]);
    expect(RX_REJECT_REASONS).toEqual([
      "unreadable",
      "outdated",
      "incomplete",
      "patient_mismatch",
      "not_prescription",
      "other",
    ]);
    expect(RX_DECLARATION_VERSION).toBe("2026-11-27");
    expect(RX_DECLARATION_TEXT).toBe(
      "This is a valid prescription from a registered doctor, written for the patient named above.",
    );
  });
});

describe("RxApproveInput", () => {
  const ok = { doctorName: "Dr A Sharma", doctorRegNo: "DMC/12345", rxDate: "2026-11-12" };

  it("accepts a complete input and trims", () => {
    expect(
      RxApproveInput.parse({ ...ok, doctorName: "  Dr A Sharma ", validUntil: "2027-01-31" }),
    ).toMatchObject({ doctorName: "Dr A Sharma", validUntil: "2027-01-31" });
  });

  it("accepts a joiner between letters or marks, as Indic spellings need", () => {
    // Marathi eyelash ra: र + virama + ZWJ + य; Persian-style ZWNJ between two letters.
    for (const doctorName of [
      "\u0930\u094D\u200D\u092F Patil",
      "\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645",
    ]) {
      expect(RxApproveInput.safeParse({ ...ok, doctorName }).success).toBe(true);
    }
  });

  it.each([
    ["unknown key", { ...ok, extra: 1 }],
    ["short reg no", { ...ok, doctorRegNo: "ab" }],
    ["reg no with a symbol", { ...ok, doctorRegNo: "DMC#1" }],
    ["long reg no", { ...ok, doctorRegNo: "A".repeat(33) }],
    ["name without a letter", { ...ok, doctorName: "12" }],
    ["name with a zero-width space", { ...ok, doctorName: "Dr\u200BSharma" }],
    ["name with a leading ZWNJ", { ...ok, doctorName: "\u200CSharma" }],
    ["name with a trailing ZWJ", { ...ok, doctorName: "Sharma\u200D" }],
    ["name with doubled joiners", { ...ok, doctorName: "Sha\u200C\u200Crma" }],
    ["name with a ZWJ then a ZWNJ", { ...ok, doctorName: "Sha\u200D\u200Crma" }],
    ["name with a joiner beside a space", { ...ok, doctorName: "Dr \u200DSharma" }],
    ["name with a bidi mark", { ...ok, doctorName: "Dr\u202ESharma" }],
    ["short name", { ...ok, doctorName: "A" }],
    ["rxDate not YMD", { ...ok, rxDate: "12/11/2026" }],
    ["validUntil not YMD", { ...ok, validUntil: "2027-1-1" }],
  ])("refuses %s", (_n, input) => {
    expect(RxApproveInput.safeParse(input).success).toBe(false);
  });
});

describe("RxRejectInput", () => {
  it("accepts a reason with an optional trimmed note", () => {
    expect(RxRejectInput.parse({ reason: "other", note: " blurry " })).toEqual({
      reason: "other",
      note: "blurry",
    });
    expect(RxRejectInput.safeParse({ reason: "outdated" }).success).toBe(true);
  });

  it.each([
    { reason: "bad" },
    { reason: "other", note: "" },
    { reason: "other", note: "x".repeat(501) },
    { reason: "other", extra: true },
  ])("refuses %j", (input) => {
    expect(RxRejectInput.safeParse(input).success).toBe(false);
  });
});

describe("reviewRx approve", () => {
  it("defaults validUntil to the six month cap", () => {
    const r = reviewRx({ status: "pending" }, approve({ rxDate: "2026-11-12" }), ctx);
    expect(r).toEqual({
      ok: true,
      from: "pending",
      set: {
        status: "approved",
        review: {
          kind: "approved",
          by: "staff-1",
          at: NOW,
          doctorName: "Dr A Sharma",
          doctorRegNo: "DMC/12345",
        },
        rxDate: istMidnight("2026-11-12"),
        validUntil: istMidnight("2027-05-12"),
      },
    });
  });

  it("stores the day after the pharmacist's last valid day", () => {
    const r = reviewRx(
      { status: "pending" },
      approve({ rxDate: "2026-11-12", validUntil: "2027-01-31" }),
      ctx,
    );
    expect(r.ok && r.set.validUntil).toEqual(istMidnight("2027-02-01"));
  });

  it("accepts the last day before the cap and refuses the cap day itself", () => {
    const last = reviewRx(
      { status: "pending" },
      approve({ rxDate: "2026-11-12", validUntil: "2027-05-11" }),
      ctx,
    );
    expect(last.ok && last.set.validUntil).toEqual(istMidnight("2027-05-12"));
    expect(
      reviewRx(
        { status: "pending" },
        approve({ rxDate: "2026-11-12", validUntil: "2027-05-12" }),
        ctx,
      ),
    ).toEqual({ ok: false, error: "valid_until_out_of_range" });
  });

  it("refuses a validUntil before the Rx date and accepts the Rx date itself", () => {
    const last = (validUntil: string) =>
      reviewRx({ status: "pending" }, approve({ rxDate: "2026-11-20", validUntil }), ctx);
    expect(last("2026-11-19")).toEqual({ ok: false, error: "valid_until_out_of_range" });
    const same = last("2026-11-20");
    expect(same.ok && same.set.validUntil).toEqual(istMidnight("2026-11-21"));
  });

  it("refuses a validUntil that has already passed", () => {
    const early = (validUntil: string) =>
      reviewRx({ status: "pending" }, approve({ rxDate: "2026-11-01", validUntil }), ctx);
    expect(early("2026-11-05")).toEqual({ ok: false, error: "valid_until_out_of_range" });
    // At is 2026-11-20 11:30 IST: the 19th ends before it, the 20th (ends 21st 00:00) does not.
    expect(early("2026-11-19")).toEqual({ ok: false, error: "valid_until_out_of_range" });
    expect(early("2026-11-20").ok).toBe(true);
  });

  it("refuses an Rx dated tomorrow (IST) and accepts today (IST)", () => {
    expect(reviewRx({ status: "pending" }, approve({ rxDate: "2026-11-21" }), ctx)).toEqual({
      ok: false,
      error: "rx_date_in_future",
    });
    expect(reviewRx({ status: "pending" }, approve({ rxDate: "2026-11-20" }), ctx).ok).toBe(true);
    // 18:30Z on the 20th is already the 21st in IST: the 21st is today, the 22nd is the future.
    const late = { at: d("2026-11-20T18:30:00Z"), by: "s" };
    expect(reviewRx({ status: "pending" }, approve({ rxDate: "2026-11-21" }), late).ok).toBe(true);
    expect(reviewRx({ status: "pending" }, approve({ rxDate: "2026-11-22" }), late).ok).toBe(false);
  });

  it("refuses an Rx that is six months old, down to the millisecond", () => {
    expect(reviewRx({ status: "pending" }, approve({ rxDate: "2026-05-20" }), ctx)).toEqual({
      ok: false,
      error: "rx_outdated",
    });
    const edge = (iso: string) =>
      reviewRx({ status: "pending" }, approve({ rxDate: "2026-05-20" }), { at: d(iso), by: "s" });
    expect(edge("2026-11-19T18:29:59.999Z").ok).toBe(true);
    expect(edge("2026-11-19T18:30:00.000Z")).toEqual({ ok: false, error: "rx_outdated" });
  });

  it("reports an impossible date as invalid_date", () => {
    expect(reviewRx({ status: "pending" }, approve({ rxDate: "2026-02-30" }), ctx)).toEqual({
      ok: false,
      error: "invalid_date",
    });
    expect(
      reviewRx(
        { status: "pending" },
        approve({ rxDate: "2026-11-12", validUntil: "2027-02-30" }),
        ctx,
      ),
    ).toEqual({ ok: false, error: "invalid_date" });
  });

  it("approves only a pending Rx", () => {
    expect(reviewRx({ status: "approved" }, approve({ rxDate: "2026-11-12" }), ctx)).toEqual({
      ok: false,
      error: "not_pending",
    });
  });
});

describe("reviewRx reject", () => {
  it("rejects a pending Rx without revoking", () => {
    expect(reviewRx({ status: "pending" }, reject("unreadable", "too dark"), ctx)).toEqual({
      ok: true,
      from: "pending",
      set: {
        status: "rejected",
        review: {
          kind: "rejected",
          by: "staff-1",
          at: NOW,
          reason: "unreadable",
          note: "too dark",
          revoked: false,
        },
      },
    });
  });

  it("stores no note as null", () => {
    const r = reviewRx({ status: "pending" }, reject("other"), ctx);
    expect(r.ok && r.set.review).toMatchObject({ note: null });
  });

  it("revokes an approved Rx and sets no dates, so a $set leaves them as they were", () => {
    const r = reviewRx({ status: "approved" }, reject("patient_mismatch"), ctx);
    expect(r).toMatchObject({
      ok: true,
      from: "approved",
      set: { status: "rejected", review: { revoked: true } },
    });
    if (!r.ok) throw new Error("unreachable");
    expect(Object.keys(r.set)).toEqual(["status", "review"]);
  });

  it("is typed so a reject cannot carry dates and an approve must", () => {
    const rej = { kind: "rejected", by: "s", at: NOW, reason: "other", note: null, revoked: false };
    const app = { kind: "approved", by: "s", at: NOW, doctorName: "Dr A", doctorRegNo: "DMC/1" };
    const review = { rejected: rej, approved: app } as const;
    // @ts-expect-error a rejection or revoke sets no dates
    const withDates: RxReviewSet = { status: "rejected", review: review.rejected, rxDate: NOW };
    // @ts-expect-error an approval sets both dates
    const noDates: RxReviewSet = { status: "approved", review: review.approved };
    expect([withDates, noDates]).toHaveLength(2);
  });

  it("fails closed on a stored status it does not know", () => {
    const bogus = { status: "bogus" as RxStatus };
    expect(reviewRx(bogus, reject(), ctx)).toEqual({ ok: false, error: "invalid_transition" });
    expect(reviewRx(bogus, approve({ rxDate: "2026-11-12" }), ctx)).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("treats a rejected Rx as final for both actions", () => {
    expect(reviewRx({ status: "rejected" }, reject(), ctx)).toEqual({ ok: false, error: "final" });
    expect(reviewRx({ status: "rejected" }, approve({ rxDate: "2026-11-12" }), ctx)).toEqual({
      ok: false,
      error: "final",
    });
  });
});
