/**
 * Customer-facing strings of /account/prescriptions and its list (R7), with the IST day helpers.
 * Pure and import-free, unlike rx-copy.ts, so the server page can read its title and sub without
 * importing any upload module (rx-api.test.ts guards those). The rejection reasons stay in
 * `RX_COPY.reasons`. Entries marked NEW wait for the owner's approval (listed in the R7 PR).
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** An IST calendar day ("2027-05-12", as the list API sends it) as the store words dates: "12 May 2027". */
export function formatIstDay(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

const IST_OFFSET_MS = 330 * 60_000;

/** The IST calendar day of an ISO instant (an upload time), as "2026-11-12". */
export function istDayOf(iso: string): string {
  return new Date(Date.parse(iso) + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The /account/prescriptions page and its list (R7). Statuses follow R1's customer view: the
 * server decides approved or expired by the 6-month IST rule and sends the days; nothing here
 * computes validity. Phase N ruling: the prototype's "We’ll text you when it’s done." stays out.
 */
export const RX_PAGE_COPY = {
  title: "Prescriptions",
  sub: "A pharmacist checks each one. Approved prescriptions stay valid for 6 months from their date.",
  // NEW: the static fallback while the session and the list load (worded like the cart's).
  loading: "Loading your prescriptions…",
  signInTitle: "Sign in to upload a prescription",
  signInBody: "Your prescriptions are private to your account.",
  signIn: "Sign in",
  upload: "Upload prescription",
  formTitle: "New prescription",
  emptyTitle: "No prescriptions yet",
  // NEW: the session or the list could not be read (a 5xx, a timeout or offline).
  loadFailed: "We couldn’t load your prescriptions. Check your connection and try again.",
  // NEW: the retry button beside it.
  retry: "Try again",
  photo: "Photo",
  pdf: "PDF",
  pages: (n: number) => `${n} ${n === 1 ? "page" : "pages"}`,
  uploaded: (day: string) => `uploaded ${day}`,
  underReview: "Under review",
  approved: (day: string) => `Approved · valid until ${day}`,
  expiredOn: (day: string) => `Expired on ${day}`,
  // NEW: fallbacks for a record without its day (the server always sends one; never shown today).
  approvedPlain: "Approved",
  expired: "Expired",
  rejected: "Rejected",
  checking: "A pharmacist is checking it.",
  expiredWhy: "Upload a newer one to order these medicines again.",
  uploadAnother: "Upload another",
  view: "View",
  newTab: "(opens in a new tab)",
} as const;
