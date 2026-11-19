import Link from "next/link";
import { Fact, LegalPage, LegalSection, legalMetadata } from "@/components/legal/legal-page";
import { ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";

const SUB = "How to reach Aarvion Pharmaceuticals.";

export const metadata = legalMetadata("Contact", SUB);

/** /contact. Phone and email stay Pending until SITE_CONFIG.customerCare is supplied. */
export default function ContactPage() {
  const { legalName, address, customerCare } = SITE_CONFIG;
  return (
    <LegalPage title="Contact" sub={SUB}>
      <LegalSection title="Address">
        <p>
          {legalName}
          {address.map((line) => (
            <span key={line}>
              <br />
              {line}
            </span>
          ))}
        </p>
      </LegalSection>

      <LegalSection title="Customer care">
        <p>
          Phone: <Fact value={customerCare?.phone} />
        </p>
        <p>
          Email: <Fact value={customerCare?.email} />
        </p>
        <p>For an order question, include your order number.</p>
      </LegalSection>

      <LegalSection title="Complaints">
        <p>
          To raise a complaint, see <Link href={ROUTES.legal.grievance}>Grievances</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
