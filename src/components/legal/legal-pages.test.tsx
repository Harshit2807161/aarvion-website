import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ContactPage, { metadata as contactMetadata } from "@/app/(store)/contact/page";
import GrievancePage from "@/app/(store)/legal/grievance/page";
import PrescriptionPolicyPage from "@/app/(store)/legal/prescription-policy/page";
import ReturnsCancellationPage from "@/app/(store)/legal/returns-cancellation/page";
import ShippingPage from "@/app/(store)/legal/shipping/page";
import { ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";
import { BANNED_CLAIMS, findClaims } from "../../../tests/helpers/claims";
import {
  Fact,
  formatPolicyDate,
  LegalPage,
  LegalSection,
  legalMetadata,
  Pending,
} from "./legal-page";

describe("formatPolicyDate", () => {
  it("prints an ISO date as day, month name and year, without Intl", () => {
    expect(formatPolicyDate("2026-11-17")).toBe("17 November 2026");
    expect(formatPolicyDate("2027-01-05")).toBe("5 January 2027");
  });
});

describe("LegalPage", () => {
  it("puts the title in the forest band and the prose, with the last-updated line, on the sheet", () => {
    const { container } = render(
      <LegalPage title="Privacy policy" sub="How we use your data.">
        <LegalSection title="Who we are">
          <p>body</p>
        </LegalSection>
      </LegalPage>,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Privacy policy" });
    expect(h1.closest(".band")).not.toBeNull();
    expect(container.querySelector(".band-sub")?.textContent).toBe("How we use your data.");
    const article = container.querySelector(".work article.prose")!;
    expect(article.textContent).toContain("Last updated 17 November 2026");
    expect(article.querySelector("time")?.getAttribute("datetime")).toBe("2026-11-17");
    const section = article.querySelector("section")!;
    expect(section.querySelector("h2")?.textContent).toBe("Who we are");
    expect(section.textContent).toContain("body");
  });

  it("Pending renders the To be added chip", () => {
    const { container } = render(<Pending />);
    expect(container.innerHTML).toBe('<span class="pending">To be added</span>');
  });

  it("Fact prints a supplied value, and Pending while it is unset or blank", () => {
    expect(render(<Fact value="A. Officer" />).container.innerHTML).toBe("A. Officer");
    for (const unset of [null, undefined, "  "]) {
      const { container } = render(<Fact value={unset} />);
      expect(container.querySelector(".pending")?.textContent).toBe("To be added");
    }
  });

  it("legalMetadata gives the page title and description", () => {
    expect(legalMetadata("Terms of use", "The terms.")).toEqual({
      title: "Terms of use",
      description: "The terms.",
    });
  });
});

describe("findClaims", () => {
  it("returns each invented claim it finds", () => {
    expect(findClaims("Rated 4.8 by 10,000+ customers. Licensed and certified.")).toEqual([
      "Licensed",
      "certified",
      "10,000+ customers",
      "Rated",
    ]);
    expect(findClaims("Read 120 reviews of our bestseller")).toEqual(["120 reviews", "bestseller"]);
  });

  it("passes plain copy and the real Rx status Under review", () => {
    expect(findClaims("Under review. Your order is under review by our pharmacist.")).toEqual([]);
    expect(findClaims("Sign-in is rate-limited and stored securely.")).toEqual([]);
    expect(BANNED_CLAIMS).toHaveLength(14);
  });

  it("flags a positive guarantee but passes a negated disclaimer", () => {
    for (const text of [
      "We guarantee genuine packs.",
      "Guaranteed delivery.",
      "A refund guarantee.",
    ])
      expect(findClaims(text)).toEqual([expect.stringMatching(/^guarantee$/i)]);
    for (const text of [
      "We do not guarantee delivery dates.",
      "Aarvion does not guarantee it.",
      "We don’t guarantee it.",
      "We cannot guarantee it.",
    ])
      expect(findClaims(text)).toEqual([]);
  });

  it("[C25] flags copy saying every medicine needs a prescription, unless the page passes allRx", () => {
    for (const text of [
      "Every listed medicine needs a valid prescription.",
      "All our medicines require a prescription.",
      "Currently listed medicines all need one.",
      "Every medicine on the store is Schedule H.",
      "Our products all require a valid Rx.",
    ]) {
      expect(findClaims(text)).not.toEqual([]);
      // allRx: true only when the page computed it from catalogue data.
      expect(findClaims(text, { allRx: true })).toEqual([]);
    }
  });

  it("[C25] passes the prescription rule stated as a rule", () => {
    for (const text of [
      "A medicine that needs a prescription is sold only against a valid prescription.",
      "Prescription medicines are dispensed only against a valid prescription.",
      "Schedule H and H1 medicines are dispensed only against a valid prescription.",
      "A pharmacist checks every prescription before an order is packed.",
      "Our pharmacist checks the prescription for every order.",
      "The price of each pack is the MRP printed on it, less ₹20.",
    ])
      expect(findClaims(text)).toEqual([]);
  });
});

describe("refund, shipping, prescription, grievance and contact pages", () => {
  const pages = [
    ["Refunds and cancellation", ReturnsCancellationPage],
    ["Shipping", ShippingPage],
    ["Prescription policy", PrescriptionPolicyPage],
    ["Grievances", GrievancePage],
    ["Contact", ContactPage],
  ] as const;

  it.each(pages)("%s has its h1 in the forest band and makes no invented claims", (name, Page) => {
    const { container } = render(<Page />);
    const h1 = screen.getByRole("heading", { level: 1, name });
    expect(h1.closest(".band")).not.toBeNull();
    expect(findClaims(container.textContent!)).toEqual([]);
  });

  it("refunds: 48 hours, 5–7 working days, and prepaid refunds are conditional on paying online", () => {
    const text = render(<ReturnsCancellationPage />).container.textContent!;
    expect(text).toContain("48 hours");
    expect(text).toContain("5–7 working days");
    expect(text).toContain("before it is packed");
    expect(text).toContain("If you paid online");
    expect(text).toContain("A cash on delivery order owes nothing");
  });

  it("shipping: free delivery, ships after approval, COD up to ₹5,000, times pending", () => {
    const { container } = render(<ShippingPage />);
    const text = container.textContent!;
    expect(text).toContain("free on every order, to any valid 6-digit pincode in India");
    expect(text).toContain("only after a pharmacist approves its prescription");
    expect(text).toContain("by SMS and email");
    expect(text).toContain("up to ₹5,000");
    expect(container.querySelectorAll(".pending").length).toBeGreaterThanOrEqual(1);
  });

  it("[C25] prescription: states the rule, never a claim about the catalogue", () => {
    const text = render(<PrescriptionPolicyPage />).container.textContent!;
    expect(text).toContain(
      "Schedule H and H1 medicines are dispensed only against a valid prescription",
    );
    expect(text).toContain("8 MB");
    expect(text).toContain("6 months");
    expect(text).not.toContain("currently listed");
    // Without allRx the C25 guard is on: any universal Rx claim would fail here.
    expect(findClaims(text)).toEqual([]);
  });

  it("grievance: officer details and timelines are pending, order number format shown", () => {
    const { container } = render(<GrievancePage />);
    expect(container.textContent).toContain("AAR-YYMM-NNNNN");
    expect(container.querySelectorAll(".pending").length).toBeGreaterThanOrEqual(3);
  });

  it("contact: both address lines, pending care details, a Grievances link", () => {
    expect(contactMetadata.title).toBe("Contact");
    const { container } = render(<ContactPage />);
    for (const line of SITE_CONFIG.address) expect(container.textContent).toContain(line);
    expect(container.querySelectorAll(".pending").length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain("For an order question, include your order number.");
    expect(screen.getByRole("link", { name: "Grievances" }).getAttribute("href")).toBe(
      ROUTES.legal.grievance,
    );
  });
});
