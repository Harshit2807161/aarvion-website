import Link from "next/link";
import { Fact, LegalPage, LegalSection, legalMetadata } from "@/components/legal/legal-page";
import { ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";

const SUB = "What a valid prescription is, how we check it, and how long it lasts.";

export const metadata = legalMetadata("Prescription policy", SUB);

/**
 * /legal/prescription-policy. [C25] States the rule, never a claim about the catalogue: not every
 * listed medicine needs a prescription, so no sentence here may say so (findClaims guards it).
 */
export default function PrescriptionPolicyPage() {
  const { registeredPharmacist } = SITE_CONFIG;
  return (
    <LegalPage title="Prescription policy" sub={SUB}>
      <LegalSection title="The rule">
        <p>Schedule H and H1 medicines are dispensed only against a valid prescription.</p>
      </LegalSection>

      <LegalSection title="What a valid prescription shows">
        <ul>
          <li>The prescriber’s name, qualification and registration number.</li>
          <li>The patient’s name.</li>
          <li>The date.</li>
          <li>The medicine and the quantity.</li>
          <li>The prescriber’s signature and stamp.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Uploading a prescription">
        <p>
          Upload a JPG, PNG, WebP or PDF file of up to 8 MB. Enter the patient’s name with it, and
          declare that the prescription is genuine and is the patient’s own.
        </p>
      </LegalSection>

      <LegalSection title="How we check it">
        <p>
          A pharmacist matches your order to the prescription before it is packed. Each prescription
          has one of three outcomes:
        </p>
        <ul>
          <li>Under review.</li>
          <li>Approved, valid until a date shown on it.</li>
          <li>
            Rejected, with a reason, which we send by SMS or email. If you paid online, the order is
            refunded.
          </li>
        </ul>
        <p>
          Pharmacist: <Fact value={registeredPharmacist} />
        </p>
      </LegalSection>

      <LegalSection title="How long it is valid">
        <p>
          A prescription is valid for 6 months from its date. It is judged on the date of your
          order, and checked again when the order is confirmed, packed and shipped. That includes a
          replacement prescription that the pharmacist approves.
        </p>
        <p>You can use the same prescription for more orders while it is valid.</p>
      </LegalSection>

      <LegalSection title="How it is stored">
        <p>
          Prescriptions are stored privately. Only you and Aarvion staff can see them, and they are
          never sent in messages. See the <Link href={ROUTES.legal.privacy}>Privacy policy</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
