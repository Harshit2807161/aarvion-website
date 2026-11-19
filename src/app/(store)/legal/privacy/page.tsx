import Link from "next/link";
import {
  Fact,
  LegalPage,
  LegalSection,
  legalMetadata,
  Pending,
} from "@/components/legal/legal-page";
import { ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";

const SUB = "How Aarvion Pharmaceuticals collects, uses and protects your personal data.";

export const metadata = legalMetadata("Privacy policy", SUB);

/**
 * /legal/privacy. Every statement comes from docs/requirements.md (§5, §9 Security, §10
 * Privacy), the rulings and the auth code as built; facts the owner has not supplied render
 * Pending. Change the copy only from those sources, and bump POLICY_VERSION when it changes in
 * substance.
 */
export default function PrivacyPage() {
  const { legalName, address, grievanceOfficer, customerCare } = SITE_CONFIG;
  return (
    <LegalPage title="Privacy policy" sub={SUB}>
      <LegalSection title="Who we are">
        <p>
          The Aarvion store is run by {legalName}, {address.join(" ")}. In this policy, “Aarvion”,
          “we” and “us” mean {legalName}.
        </p>
        <p>
          Grievance officer: <Fact value={grievanceOfficer} />
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul>
          <li>The mobile number or email address you sign in with, and your name.</li>
          <li>The delivery addresses you save, with the name and phone number for each.</li>
          <li>The prescriptions you upload, and the patient name you enter with each one.</li>
          <li>Your orders and their payment status.</li>
          <li>The session cookie and the IP address we use to keep accounts secure.</li>
        </ul>
        <p>
          If you pay online, your card, UPI and bank details are handled by Razorpay and are not
          stored by Aarvion.
        </p>
      </LegalSection>

      <LegalSection title="Why we use it">
        <ul>
          <li>To sign you in.</li>
          <li>So that a registered pharmacist can check your prescriptions.</li>
          <li>To process and deliver your orders.</li>
          <li>To send you order updates by SMS and email.</li>
          <li>To prevent abuse of the store, such as repeated sign-in attempts.</li>
          <li>To send you marketing messages, only if you opt in. Marketing is off by default.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your consent">
        <p>
          When you create an account, you give your consent by ticking a box to agree to the{" "}
          <Link href={ROUTES.legal.terms}>Terms of use</Link> and this Privacy policy, and you
          declare that you are 18 or older. Marketing messages need a separate opt-in.
        </p>
        <p>
          You can switch marketing off at any time in{" "}
          <Link href={ROUTES.account}>your account</Link>. We need your data to process orders, so
          withdrawing your consent for that means closing your account.
        </p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <ul>
          <li>Aarvion’s pharmacists and staff, to check prescriptions and fulfil orders.</li>
          <li>The courier, who receives the name, address and phone number for delivery.</li>
          <li>Razorpay, if you pay online.</li>
          <li>The providers that deliver our SMS and email.</li>
          <li>The providers that host the store and its database.</li>
        </ul>
        <p>
          We never sell your personal data. Our SMS and email messages never include the contents of
          a prescription or a diagnosis.
        </p>
      </LegalSection>

      <LegalSection title="Where it is stored and for how long">
        <p>
          Where your data is stored: <Pending />
        </p>
        <p>
          How long we keep each kind of data: <Pending />
        </p>
      </LegalSection>

      <LegalSection title="How we protect it">
        <ul>
          <li>
            We store each one-time sign-in code only in a scrambled (hashed) form, never as the code
            itself. A code works once, allows at most 5 tries and expires after 5 minutes.
          </li>
          <li>Sign-in sessions are stored only in scrambled (hashed) form too.</li>
          <li>Sign-in is rate-limited.</li>
          <li>
            Prescriptions are stored privately and are visible only to you and Aarvion staff. Their
            contents never appear in our messages or logs.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Your rights under the Digital Personal Data Protection Act, 2023">
        <p>You have the right to:</p>
        <ul>
          <li>get a summary of the personal data we hold about you and how we use it;</li>
          <li>have your personal data corrected, completed or updated;</li>
          <li>have your personal data erased;</li>
          <li>
            have a grievance about your data addressed (see{" "}
            <Link href={ROUTES.legal.grievance}>Grievances</Link>);
          </li>
          <li>
            nominate another person to exercise these rights for you if you die or become unable to.
          </li>
        </ul>
        <p>You can download your data, or ask us to delete your account, from your account page.</p>
      </LegalSection>

      <LegalSection title="Age">
        <p>Accounts are for people aged 18 or older. You declare your age when you sign up.</p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We use one essential cookie, which keeps you signed in. We do not use advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>When this policy changes, we update this page and the date at the top.</p>
        <p>
          To raise a complaint about how we handle your data, see{" "}
          <Link href={ROUTES.legal.grievance}>Grievances</Link>.
        </p>
        <p>
          Customer care phone: <Fact value={customerCare?.phone} />
        </p>
        <p>
          Customer care email: <Fact value={customerCare?.email} />
        </p>
      </LegalSection>
    </LegalPage>
  );
}
