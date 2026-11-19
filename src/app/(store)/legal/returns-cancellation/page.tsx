import Link from "next/link";
import { LegalPage, LegalSection, legalMetadata, Pending } from "@/components/legal/legal-page";
import { ROUTES } from "@/config/routes";

const SUB = "When you can cancel an order, when a medicine can be returned, and how refunds work.";

export const metadata = legalMetadata("Refunds and cancellation", SUB);

/**
 * /legal/returns-cancellation. Prepaid sentences are conditional ("If you paid online") because
 * SITE_CONFIG.onlinePayments is false until go-live; they stay true before and after it. Keep
 * "5–7 working days" and "48 hours" exact: the page test and the brief pin them.
 */
export default function ReturnsCancellationPage() {
  return (
    <LegalPage title="Refunds and cancellation" sub={SUB}>
      <LegalSection title="Cancelling an order">
        <p>You can cancel an order at any time before it is packed.</p>
        <p>
          If you paid online, the refund goes to the original payment method in 5–7 working days. If
          you chose cash on delivery, you have paid nothing, so there is nothing to refund.
        </p>
      </LegalSection>

      <LegalSection title="If your prescription is rejected">
        <p>
          If the pharmacist rejects your prescription, the order is put on hold. If you paid online,
          the order is refunded to the original payment method in 5–7 working days. A cash on
          delivery order owes nothing. See the{" "}
          <Link href={ROUTES.legal.prescription}>Prescription policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Returning a medicine">
        <p>
          We take back a medicine only if it arrives damaged, it is not the one you ordered, or it
          is expired. Tell us within 48 hours of delivery.
        </p>
      </LegalSection>

      <LegalSection title="How to report a problem">
        <p>
          Contact customer care and include your order number. Customer care phone and email:{" "}
          <Pending />
        </p>
        <p>
          See <Link href={ROUTES.contact}>Contact</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
