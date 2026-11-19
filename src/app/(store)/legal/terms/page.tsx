import Link from "next/link";
import { LegalPage, LegalSection, legalMetadata, Pending } from "@/components/legal/legal-page";
import { ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";

const SUB = "The terms for using the Aarvion store and ordering medicines.";

export const metadata = legalMetadata("Terms of use", SUB);

/**
 * /legal/terms. Every rule comes from docs/requirements.md (§5, §7), the accepted defaults and
 * the "Prescription validity" ruling in docs/decisions/rulings.md, and SITE_CONFIG; terms the
 * owner has not supplied render Pending. The prescription rule is stated as a rule, not as a
 * claim about the catalogue [C25]. Bump POLICY_VERSION when the copy changes in substance.
 */
export default function TermsPage() {
  const { legalName, address, onlinePayments } = SITE_CONFIG;
  return (
    <LegalPage title="Terms of use" sub={SUB}>
      <LegalSection title="About these terms">
        <p>
          These terms apply when you use the Aarvion store and order medicines from it. The store is
          run by {legalName}, {address.join(" ")}. In these terms, “Aarvion”, “we” and “us” mean{" "}
          {legalName}.
        </p>
        <p>
          When you create an account, you agree to these terms and to the{" "}
          <Link href={ROUTES.legal.privacy}>Privacy policy</Link> by ticking a box.
        </p>
      </LegalSection>

      <LegalSection title="Who can order">
        <p>You must be 18 or older to create an account and order. We deliver only within India.</p>
      </LegalSection>

      <LegalSection title="Signing in">
        <p>
          You sign in with a one-time code that we send by SMS or email. Each code expires after 5
          minutes. Keep the code private: Aarvion staff will never ask you for it.
        </p>
      </LegalSection>

      <LegalSection title="Prescriptions">
        <p>
          A medicine that needs a prescription is sold only against a valid prescription from a
          registered medical practitioner. Our pharmacist checks the prescription for every order
          and may decline it; if that happens, we tell you why.
        </p>
        <p>
          A prescription is valid for 6 months from the date it was written, or until an earlier
          date the pharmacist records when approving it. It is judged on the date you place the
          order, and checked again when the order is confirmed, packed and shipped. Those later
          checks use the prescription attached to the order at the time, which can be a replacement
          the pharmacist has approved.
        </p>
      </LegalSection>

      <LegalSection title="Prices">
        <p>
          The price of each pack is the MRP printed on it, less ₹20. The MRP includes all taxes. The
          price is worked out again on our server when you check out, so if a pack’s MRP changes,
          our price changes with it.
        </p>
      </LegalSection>

      <LegalSection title="Orders and payment">
        <p>
          You can pay online through Razorpay (UPI, cards or netbanking), or by cash on delivery for
          orders up to ₹5,000.
          {!onlinePayments &&
            " Online payment is not available yet; until it is, cash on delivery is the only way to pay."}
        </p>
        <p>You can order at most 10 packs of any one medicine, and 20 packs in one order.</p>
        <p>
          If you pay online, you pay when you place the order. If the pharmacist rejects the
          prescription, the order is put on hold and your payment is refunded.
        </p>
      </LegalSection>

      <LegalSection title="Delivery">
        <p>
          Delivery is free to any valid 6-digit pincode in India. An order ships only after the
          pharmacist has approved its prescription.
        </p>
      </LegalSection>

      <LegalSection title="Cancellations and returns">
        <p>
          You can cancel an order until it is packed. Medicines cannot be returned unless they
          arrive damaged, wrong or expired and you tell us within 48 hours of delivery. How
          cancellations, returns and refunds work is set out in our{" "}
          <Link href={ROUTES.legal.returns}>Refunds and cancellation</Link> policy.
        </p>
      </LegalSection>

      <LegalSection title="No medical advice">
        <p>
          The information on this store is not medical advice. Always follow your doctor’s advice
          about your medicines.
        </p>
      </LegalSection>

      <LegalSection title="Liability and governing law">
        <p>
          Limits on our liability: <Pending />
        </p>
        <p>
          Governing law and jurisdiction: <Pending />
        </p>
      </LegalSection>

      <LegalSection title="Grievances">
        <p>
          If you have a complaint about the store or an order, see{" "}
          <Link href={ROUTES.legal.grievance}>Grievances</Link> for how to reach our grievance
          officer.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>When these terms change, we update this page and the date at the top.</p>
      </LegalSection>
    </LegalPage>
  );
}
