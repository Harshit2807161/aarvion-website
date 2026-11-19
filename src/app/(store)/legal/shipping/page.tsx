import Link from "next/link";
import { LegalPage, LegalSection, legalMetadata, Pending } from "@/components/legal/legal-page";
import { ROUTES } from "@/config/routes";

const SUB = "Delivery charges, when an order ships, and how you pay.";

export const metadata = legalMetadata("Shipping", SUB);

/**
 * /legal/shipping. No COD cap constant exists in the code yet, so "₹5,000" is written here;
 * move it to config when checkout adds one. Delivery times are not supplied, so they are Pending.
 */
export default function ShippingPage() {
  return (
    <LegalPage title="Shipping" sub={SUB}>
      <LegalSection title="Delivery charge and area">
        <p>Delivery is free on every order, to any valid 6-digit pincode in India.</p>
      </LegalSection>

      <LegalSection title="When your order ships">
        <p>
          An order ships only after a pharmacist approves its prescription. When it ships, we send
          you the courier’s name and a tracking link by SMS and email. See the{" "}
          <Link href={ROUTES.legal.prescription}>Prescription policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Delivery times">
        <p>
          How long delivery takes: <Pending />
        </p>
      </LegalSection>

      <LegalSection title="Paying on delivery">
        <p>Cash on delivery is available for orders up to ₹5,000.</p>
      </LegalSection>

      <LegalSection title="Problems with a delivery">
        <p>
          If a medicine arrives damaged, wrong or expired, see{" "}
          <Link href={ROUTES.legal.returns}>Refunds and cancellation</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
