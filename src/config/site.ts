/**
 * Site identity and the legal facts the owner still has to supply. Pure data and pure
 * functions: no env reads and no import-time throws, so client and server code may import it.
 *
 * Every pending legal fact is `null` and renders as LEGAL_PLACEHOLDER. The production gate
 * (assertLegalConfigComplete, the H4 hook) refuses to ship while any is still pending.
 */
export const LEGAL_PLACEHOLDER = "To be added";

/** Version stamp of the policy copy; bump it when a policy page changes in substance. */
export const POLICY_VERSION = "2026-11-17";

export type SiteConfig = {
  legalName: string;
  /** Postal address, one entry per printed line. */
  address: readonly string[];
  copyrightYear: number;
  drugLicenceNumbers: readonly string[] | null;
  registeredPharmacist: string | null;
  grievanceOfficer: string | null;
  gstin: string | null;
  customerCare: { phone: string | null; email: string | null } | null;
};

export const SITE_CONFIG: SiteConfig = {
  legalName: "Aarvion Pharmaceuticals",
  address: [
    "Plot No. 70, Second Floor, Functional Industrial Estate,",
    "Patparganj, New Delhi 110092",
  ],
  copyrightYear: 2026,
  drugLicenceNumbers: null,
  registeredPharmacist: null,
  grievanceOfficer: null,
  gstin: null,
  customerCare: null,
};

export type LegalField =
  "drugLicenceNumbers" | "registeredPharmacist" | "grievanceOfficer" | "gstin" | "customerCare";

const LEGAL_FIELDS: readonly LegalField[] = [
  "drugLicenceNumbers",
  "registeredPharmacist",
  "grievanceOfficer",
  "gstin",
  "customerCare",
];

function isPending(value: SiteConfig[LegalField]): boolean {
  if (value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  // Partial customer care details (only a phone, or only an email) are still pending.
  const care = value as NonNullable<SiteConfig["customerCare"]>;
  return !care.phone?.trim() || !care.email?.trim();
}

/** The legal fields that are still unset, in display order. */
export function pendingLegalFields(cfg: SiteConfig = SITE_CONFIG): LegalField[] {
  return LEGAL_FIELDS.filter((f) => isPending(cfg[f]));
}

export class LegalConfigError extends Error {
  constructor(readonly fields: readonly LegalField[]) {
    super(`Legal configuration incomplete, still pending: ${fields.join(", ")}`);
    this.name = "LegalConfigError";
  }
}

/**
 * The H4 hook: call it from the production launch gate (never at import time) so a deploy
 * cannot go live with "To be added" in the footer. Throws a LegalConfigError naming every
 * pending field.
 */
export function assertLegalConfigComplete(cfg: SiteConfig = SITE_CONFIG): void {
  const pending = pendingLegalFields(cfg);
  if (pending.length > 0) throw new LegalConfigError(pending);
}

/** What to print for a legal fact: the value, or LEGAL_PLACEHOLDER while it is unset. */
export function legalValue(v: string | null | undefined): string {
  return v && v.trim() !== "" ? v : LEGAL_PLACEHOLDER;
}

/** Local dev origin, used only when APP_URL is unset (CI builds, local runs). */
const DEV_SITE_URL = "http://localhost:3000";

/**
 * The origin Next resolves relative metadata URLs (opengraph-image, icons) against. Takes
 * APP_URL as an argument so this module stays free of env access; the root layout passes the
 * raw `process.env.APP_URL`. Falls back to the dev origin on any invalid value.
 */
export function resolveSiteMetadataBase(appUrl: string | undefined): URL {
  // Total: a missing, blank or malformed value, or a non-http(s) one, must never break the build.
  try {
    const url = new URL(appUrl?.trim() || DEV_SITE_URL);
    if (url.protocol === "http:" || url.protocol === "https:") return url;
  } catch {
    // fall through to the dev origin
  }
  return new URL(DEV_SITE_URL);
}
