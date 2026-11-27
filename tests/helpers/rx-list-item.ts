import type { RxListItem } from "../../src/server/prescriptions/review";

/** One customer list row as the API returns it: Asha Rao's image, under review, uploaded now. */
export function rxListItem(extra: Partial<RxListItem> = {}): RxListItem {
  return {
    id: "0123456789abcdef01234567",
    patientName: "Asha Rao",
    kind: "image",
    pages: 1,
    uploadedAt: new Date().toISOString(),
    status: "under_review",
    validUntilDay: null,
    expiredOnDay: null,
    rejection: null,
    ...extra,
  };
}
