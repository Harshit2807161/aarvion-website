import {
  Fact,
  LegalPage,
  LegalSection,
  legalMetadata,
  Pending,
} from "@/components/legal/legal-page";
import { SITE_CONFIG } from "@/config/site";

const SUB = "How to raise a complaint with Aarvion Pharmaceuticals.";

export const metadata = legalMetadata("Grievances", SUB);

/** /legal/grievance. The officer's details and the response timelines are not supplied: Pending. */
export default function GrievancePage() {
  const { grievanceOfficer } = SITE_CONFIG;
  return (
    <LegalPage title="Grievances" sub={SUB}>
      <LegalSection title="Grievance officer">
        <p>
          Name: <Fact value={grievanceOfficer} />
        </p>
        <p>
          Email: <Pending />
        </p>
        <p>
          Phone: <Pending />
        </p>
      </LegalSection>

      <LegalSection title="What to include">
        <ul>
          <li>Your order number, which looks like AAR-YYMM-NNNNN.</li>
          <li>What happened.</li>
          <li>Your contact details.</li>
        </ul>
      </LegalSection>

      <LegalSection title="When we respond">
        <p>
          How quickly we acknowledge and resolve a grievance: <Pending />
        </p>
      </LegalSection>
    </LegalPage>
  );
}
