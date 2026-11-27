import { describe, expect, it } from "vitest";
import {
  RX_DECLARATION_TEXT,
  RX_DECLARATION_VERSION,
  RX_REJECT_REASONS,
  RX_STATUSES,
  RxApproveInput,
  RxRejectInput,
} from "./review";

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
