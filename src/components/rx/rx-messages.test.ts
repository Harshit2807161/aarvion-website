import { describe, expect, it } from "vitest";
import { RX_COPY } from "./rx-copy";
import { patientError, rxFailure } from "./rx-messages";

const file = { name: "rx.jpg", blob: new Blob([new Uint8Array(9 * 1_048_576)]) };

describe("patientError", () => {
  it("follows the server's name rule", () => {
    expect(patientError("  ")).toBe(RX_COPY.patientRequired);
    expect(patientError("A")).toBe(RX_COPY.patientInvalid);
    expect(patientError("12")).toBe(RX_COPY.patientInvalid);
    expect(patientError("x".repeat(81))).toBe(RX_COPY.patientTooLong);
    expect(patientError(" Asha Rao ")).toBeUndefined();
  });
});

describe("rxFailure", () => {
  it.each([
    ["corrupt", RX_COPY.corrupt],
    ["empty", RX_COPY.corrupt],
    ["too_small", RX_COPY.tooSmall],
    ["animated", RX_COPY.animated],
    ["too_many_pages", RX_COPY.tooManyPages],
    ["encrypted", RX_COPY.pdfBlocked],
    ["active_content", RX_COPY.pdfBlocked],
    ["unsupported_type", RX_COPY.unsupported("rx.jpg")],
    ["too_large", RX_COPY.tooLarge("rx.jpg", "9.0 MB")],
  ] as const)("a %s file goes on the drop zone", (error, message) => {
    expect(rxFailure({ ok: false, error }, file)).toEqual({ where: "file", message });
  });

  it("a refused name goes on the name field, everything else in the form note", () => {
    expect(rxFailure({ ok: false, error: "invalid_request" }, file).where).toBe("patient");
    expect(rxFailure({ ok: false, error: "busy", retryAfterSec: 5 }, file)).toEqual({
      where: "form",
      message: RX_COPY.busy,
    });
    expect(rxFailure({ ok: false, error: "upload_expired" }, file).message).toBe(RX_COPY.expired);
    expect(rxFailure({ ok: false, error: "upload_unknown" }, file)).toEqual({
      where: "form",
      message: RX_COPY.unknown,
    });
    expect(rxFailure({ ok: false, error: "file_missing" }, file).message).toBe(RX_COPY.expired);
    expect(rxFailure({ ok: false, error: "rate_limited", retryAfterSec: 3600 }, file).message).toBe(
      RX_COPY.rateLimited("1 hour"),
    );
    expect(
      rxFailure({ ok: false, error: "upload_unconfirmed", retryAfterSec: 30 }, file).message,
    ).toBe(RX_COPY.unconfirmed("30 seconds"));
    expect(rxFailure({ ok: false, error: "unauthenticated" }, file).message).toBe(RX_COPY.signIn);
    expect(rxFailure({ ok: false, error: "network" }, file).message).toBe(RX_COPY.network);
  });
});
