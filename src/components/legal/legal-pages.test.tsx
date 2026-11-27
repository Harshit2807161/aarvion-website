import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ContactPage, { metadata as contactMetadata } from "@/app/(store)/contact/page";
import GrievancePage from "@/app/(store)/legal/grievance/page";
import PrescriptionPolicyPage from "@/app/(store)/legal/prescription-policy/page";
import ReturnsCancellationPage from "@/app/(store)/legal/returns-cancellation/page";
import ShippingPage from "@/app/(store)/legal/shipping/page";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/(store)/legal/privacy/page";
import TermsPage, { metadata as termsMetadata } from "@/app/(store)/legal/terms/page";
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
    expect(BANNED_CLAIMS).toHaveLength(16);
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

/** The page's h2 texts in document order. */
const h2s = (root: HTMLElement) => [...root.querySelectorAll("h2")].map((h) => h.textContent);

describe("Privacy policy", () => {
  const sub = "How Aarvion Pharmaceuticals collects, uses and protects your personal data.";

  it("has the h1, the sub, the last-updated line and the metadata", () => {
    const { container } = render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeInTheDocument();
    expect(container.querySelector(".band-sub")?.textContent).toBe(sub);
    expect(container.textContent).toContain("Last updated 17 November 2026");
    // The date is stated once, at the top (13b review).
    expect(container.textContent!.split("17 November 2026")).toHaveLength(2);
    expect(privacyMetadata).toEqual({ title: "Privacy policy", description: sub });
  });

  it("has the 11 sections in order", () => {
    expect(h2s(render(<PrivacyPage />).container)).toEqual([
      "Who we are",
      "What we collect",
      "Why we use it",
      "Your consent",
      "Who we share it with",
      "Where it is stored and for how long",
      "How we protect it",
      "Your rights under the Digital Personal Data Protection Act, 2023",
      "Age",
      "Cookies",
      "Changes and contact",
    ]);
  });

  it("states consent, sharing and protection as built, and marks the pending facts", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent!;
    expect(text).toContain("Aarvion Pharmaceuticals, Plot No. 70, Second Floor");
    expect(text).toContain("off by default");
    expect(text).toContain("not stored by Aarvion");
    expect(text).toContain("We never sell your personal data.");
    expect(text).toContain("expires after 5 minutes");
    expect(text).toContain("only in a scrambled (hashed) form, never as the code itself");
    expect(text).toContain("Sign-in sessions are stored only in scrambled (hashed) form too.");
    expect(text).not.toMatch(/HMAC|keyed hash/);
    expect(text).toContain("never appear in our messages or logs");
    expect(container.querySelectorAll(".pending").length).toBeGreaterThanOrEqual(3);
  });

  it("links to the grievance page and to the account", () => {
    render(<PrivacyPage />);
    for (const link of screen.getAllByRole("link", { name: "Grievances" }))
      expect(link.getAttribute("href")).toBe(ROUTES.legal.grievance);
    expect(screen.getByRole("link", { name: "your account" }).getAttribute("href")).toBe(
      ROUTES.account,
    );
  });

  it("makes no invented claims", () => {
    expect(findClaims(render(<PrivacyPage />).container.textContent!)).toEqual([]);
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

describe("Terms of use", () => {
  const sub = "The terms for using the Aarvion store and ordering medicines.";

  it("has the h1, the sub, the last-updated line and the metadata", () => {
    const { container } = render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of use" })).toBeInTheDocument();
    expect(container.querySelector(".band-sub")?.textContent).toBe(sub);
    expect(container.textContent).toContain("Last updated 17 November 2026");
    expect(termsMetadata).toEqual({ title: "Terms of use", description: sub });
  });

  it("has the 12 sections in order", () => {
    expect(h2s(render(<TermsPage />).container)).toEqual([
      "About these terms",
      "Who can order",
      "Signing in",
      "Prescriptions",
      "Prices",
      "Orders and payment",
      "Delivery",
      "Cancellations and returns",
      "No medical advice",
      "Liability and governing law",
      "Grievances",
      "Changes",
    ]);
  });

  it("states the accepted business rules and the prescription validity ruling", () => {
    const { container } = render(<TermsPage />);
    const text = container.textContent!;
    for (const fact of ["₹20", "₹5,000", "10 packs", "20 packs", "6 months"])
      expect(text).toContain(fact);
    expect(text).toContain("registered medical practitioner");
    expect(text).toContain("confirmed, packed and shipped");
    expect(text).toContain("Aarvion staff will never ask you for it");
    expect(container.querySelectorAll(".pending").length).toBeGreaterThanOrEqual(2);
  });

  it("links to the privacy, refunds and grievance pages", () => {
    render(<TermsPage />);
    const href = (name: string) => screen.getByRole("link", { name }).getAttribute("href");
    expect(href("Privacy policy")).toBe(ROUTES.legal.privacy);
    expect(href("Refunds and cancellation")).toBe(ROUTES.legal.returns);
    expect(href("Grievances")).toBe(ROUTES.legal.grievance);
  });

  it("names online payment only once onlinePayments is on, as the footer does", () => {
    const online = /Razorpay|UPI|cards|netbanking|pay online/i;
    const was = SITE_CONFIG.onlinePayments;
    try {
      SITE_CONFIG.onlinePayments = false;
      const cod = render(<TermsPage />).container.textContent!;
      expect(cod).toContain("You pay by cash on delivery, for orders up to ₹5,000.");
      expect(cod).toContain("Online payment is not available yet.");
      expect(cod).not.toMatch(online);
      cleanup();
      SITE_CONFIG.onlinePayments = true;
      const live = render(<TermsPage />).container.textContent!;
      expect(live).toContain(
        "You can pay online through Razorpay (UPI, cards or netbanking), or by cash on delivery for orders up to ₹5,000.",
      );
      expect(live).toContain("If you pay online, you pay when you place the order.");
      expect(live).not.toContain("Online payment is not available yet");
    } finally {
      SITE_CONFIG.onlinePayments = was;
    }
  });

  it("makes no invented claims", () => {
    expect(findClaims(render(<TermsPage />).container.textContent!)).toEqual([]);
  });
});
