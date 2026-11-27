/**
 * What the upload form says for each answer: the patient-name check (the server's rule: 2 to 80
 * characters with a letter) and where a failed upload's message goes (the drop zone for a file
 * problem, the name field, or a form-level note) with its words. Pure, no React.
 */
import { waitText } from "@/components/auth/login-copy";
import type { RxUploadResult } from "./rx-api";
import { fileSize, RX_COPY } from "./rx-copy";

export function patientError(value: string): string | undefined {
  const name = value.trim();
  if (!name) return RX_COPY.patientRequired;
  if (name.length > 80) return RX_COPY.patientTooLong;
  if (name.length < 2 || !/\p{L}/u.test(name)) return RX_COPY.patientInvalid;
  return undefined;
}

/** Short waits in seconds ("30 seconds"), longer ones in words ("2 minutes"). */
const waitWords = (sec: number | undefined) =>
  sec !== undefined && sec > 0 && sec < 60 ? `${Math.ceil(sec)} seconds` : waitText(sec);

/** Where a failed upload's message goes, and what it says. */
export function rxFailure(
  r: Extract<RxUploadResult, { ok: false }>,
  file: { name: string; blob: Blob },
): { where: "file" | "patient" | "form"; message: string } {
  switch (r.error) {
    case "empty":
    case "corrupt":
      return { where: "file", message: RX_COPY.corrupt };
    case "too_small":
      return { where: "file", message: RX_COPY.tooSmall };
    case "animated":
      return { where: "file", message: RX_COPY.animated };
    case "too_many_pages":
      return { where: "file", message: RX_COPY.tooManyPages };
    case "encrypted":
    case "active_content":
      return { where: "file", message: RX_COPY.pdfBlocked };
    case "unsupported_type":
      return { where: "file", message: RX_COPY.unsupported(file.name) };
    case "too_large":
      return { where: "file", message: RX_COPY.tooLarge(file.name, fileSize(file.blob.size)) };
    case "invalid_request":
      return { where: "patient", message: RX_COPY.patientInvalid };
    case "busy":
      return { where: "form", message: RX_COPY.busy };
    case "upload_unknown":
      return { where: "form", message: RX_COPY.unknown };
    case "file_missing":
    case "upload_expired":
      return { where: "form", message: RX_COPY.expired };
    case "rate_limited":
      return { where: "form", message: RX_COPY.rateLimited(waitText(r.retryAfterSec)) };
    case "upload_unconfirmed":
      return { where: "form", message: RX_COPY.unconfirmed(waitWords(r.retryAfterSec)) };
    case "unauthenticated":
      return { where: "form", message: RX_COPY.signIn };
    default:
      return { where: "form", message: RX_COPY.network };
  }
}
