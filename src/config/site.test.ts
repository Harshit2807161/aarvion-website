import { describe, expect, it } from "vitest";
import {
  assertLegalConfigComplete,
  LEGAL_PLACEHOLDER,
  LegalConfigError,
  legalValue,
  pendingLegalFields,
  POLICY_VERSION,
  resolveSiteMetadataBase,
  SITE_CONFIG,
  type SiteConfig,
} from "./site";

const filled: SiteConfig = {
  ...SITE_CONFIG,
  drugLicenceNumbers: ["DL-1"],
  registeredPharmacist: "A. Pharmacist",
  grievanceOfficer: "B. Officer",
  gstin: "07AAAAA0000A1Z5",
  customerCare: { phone: "+91 11 0000 0000", email: "care@example.test" },
};

describe("SITE_CONFIG", () => {
  it("holds the owner-supplied identity and leaves every pending legal fact null", () => {
    expect(SITE_CONFIG.legalName).toBe("Aarvion Pharmaceuticals");
    expect(SITE_CONFIG.address).toEqual([
      "Plot No. 70, Second Floor, Functional Industrial Estate,",
      "Patparganj, New Delhi 110092",
    ]);
    expect(SITE_CONFIG.copyrightYear).toBe(2026);
    expect(SITE_CONFIG.drugLicenceNumbers).toBeNull();
    expect(SITE_CONFIG.registeredPharmacist).toBeNull();
    expect(SITE_CONFIG.grievanceOfficer).toBeNull();
    expect(SITE_CONFIG.gstin).toBeNull();
    expect(SITE_CONFIG.customerCare).toBeNull();
    expect(POLICY_VERSION).toBe("2026-11-17");
  });
});

describe("legal config", () => {
  it("lists the 5 pending fields", () => {
    expect(pendingLegalFields()).toEqual([
      "drugLicenceNumbers",
      "registeredPharmacist",
      "grievanceOfficer",
      "gstin",
      "customerCare",
    ]);
  });

  it("assertLegalConfigComplete throws a LegalConfigError naming all 5", () => {
    expect(() => assertLegalConfigComplete()).toThrow(LegalConfigError);
    try {
      assertLegalConfigComplete();
    } catch (e) {
      const msg = (e as Error).message;
      for (const f of pendingLegalFields()) expect(msg).toContain(f);
      expect((e as Error).name).toBe("LegalConfigError");
    }
  });

  it("does not throw for a filled config, which has nothing pending", () => {
    expect(pendingLegalFields(filled)).toEqual([]);
    expect(() => assertLegalConfigComplete(filled)).not.toThrow();
  });

  it("treats an empty licence list or blank string as pending", () => {
    expect(pendingLegalFields({ ...filled, drugLicenceNumbers: [] })).toEqual([
      "drugLicenceNumbers",
    ]);
    expect(pendingLegalFields({ ...filled, gstin: "  " })).toEqual(["gstin"]);
  });

  it("treats partial customer care details as pending", () => {
    expect(
      pendingLegalFields({ ...filled, customerCare: { phone: "+91 11 0000 0000", email: null } }),
    ).toEqual(["customerCare"]);
    expect(
      pendingLegalFields({ ...filled, customerCare: { phone: null, email: "a@b.test" } }),
    ).toEqual(["customerCare"]);
  });

  it("legalValue shows the placeholder for null and the value otherwise", () => {
    expect(LEGAL_PLACEHOLDER).toBe("To be added");
    expect(legalValue(null)).toBe("To be added");
    expect(legalValue(undefined)).toBe("To be added");
    expect(legalValue("")).toBe("To be added");
    expect(legalValue("07AAAAA0000A1Z5")).toBe("07AAAAA0000A1Z5");
  });
});

describe("resolveSiteMetadataBase", () => {
  it("uses APP_URL when set", () => {
    expect(resolveSiteMetadataBase("https://aarvion.example/").origin).toBe(
      "https://aarvion.example",
    );
  });

  it("falls back to the local dev origin when APP_URL is unset or blank", () => {
    expect(resolveSiteMetadataBase(undefined).href).toBe("http://localhost:3000/");
    expect(resolveSiteMetadataBase("").href).toBe("http://localhost:3000/");
  });

  it("falls back for a malformed or non-http(s) value instead of throwing", () => {
    for (const bad of [
      "not a url",
      "aarvion.example",
      "ftp://aarvion.example",
      "javascript:alert(1)",
    ]) {
      expect(resolveSiteMetadataBase(bad).href).toBe("http://localhost:3000/");
    }
  });
});
