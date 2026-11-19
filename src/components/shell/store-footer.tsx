import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { LEGAL_PLACEHOLDER, legalValue, SITE_CONFIG } from "@/config/site";
import type { Category } from "@/server/catalogue/schema";
import { Brand } from "./brand";

const { legalName, address, copyrightYear } = SITE_CONFIG;

/** A footer item whose page does not exist yet: the label with a "To be added" pill. */
function Pending({ label }: { label: string }) {
  return (
    <li>
      <span className="foot-tba">
        {label}
        <span className="tba">{LEGAL_PLACEHOLDER}</span>
      </span>
    </li>
  );
}

function FootLink({ href, children }: { href: string; children: string }) {
  return (
    <li>
      <Link href={href}>{children}</Link>
    </li>
  );
}

/** Aarvion's licence numbers may be several; print them as one comma-separated line. */
const licences = SITE_CONFIG.drugLicenceNumbers?.join(", ");

/**
 * The store footer, ported from the prototype's chromeFoot. A server component: pass the
 * live categories (the root layout reads them from the cached catalogue).
 */
export function StoreFooter({ categories }: { categories: readonly Category[] }) {
  const care = SITE_CONFIG.customerCare;
  return (
    <footer className="foot" id="contact">
      <div className="wrap foot-top">
        <div className="foot-brand">
          <Brand variant="foot" />
          <p className="foot-about">
            Aarvion’s own prescription medicines, sold by Aarvion. A pharmacist checks every
            prescription before an order is packed.
          </p>
        </div>
        <nav className="foot-col" aria-labelledby="f-shop">
          <h2 className="foot-h" id="f-shop">
            Shop by category
          </h2>
          <ul>
            {categories.map((c) => (
              <FootLink key={c.slug} href={ROUTES.category(c.slug)}>
                {c.name}
              </FootLink>
            ))}
            <FootLink href={ROUTES.medicines}>All medicines</FootLink>
          </ul>
        </nav>
        <nav className="foot-col" aria-labelledby="f-help">
          <h2 className="foot-h" id="f-help">
            Help and policies
          </h2>
          <ul>
            <FootLink href="/#how">How ordering works</FootLink>
            <FootLink href="/#questions">Questions</FootLink>
            <FootLink href={ROUTES.account}>Track an order</FootLink>
            <FootLink href={ROUTES.legal.returns}>Refunds and cancellation</FootLink>
            <FootLink href={ROUTES.legal.shipping}>Shipping</FootLink>
            <FootLink href={ROUTES.legal.prescription}>Prescription policy</FootLink>
            <FootLink href={ROUTES.legal.privacy}>Privacy policy</FootLink>
            <FootLink href={ROUTES.legal.terms}>Terms of use</FootLink>
            <FootLink href={ROUTES.legal.grievance}>Grievances</FootLink>
          </ul>
        </nav>
        <nav className="foot-col" aria-labelledby="f-company">
          <h2 className="foot-h" id="f-company">
            Company
          </h2>
          <ul>
            <Pending label="About Aarvion" />
            <FootLink href="/#faq-win2age">Why some packs say Win2Age</FootLink>
            <FootLink href={ROUTES.account}>Your account</FootLink>
            <FootLink href={ROUTES.contact}>Contact</FootLink>
          </ul>
        </nav>
        <div className="foot-col">
          <h2 className="foot-h">Contact</h2>
          <address>
            {legalName}
            {address.map((line) => (
              <span key={line}>
                <br />
                {line}
              </span>
            ))}
          </address>
          <dl className="foot-dl">
            <div>
              <dt>Phone</dt>
              <dd>{legalValue(care?.phone)}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{legalValue(care?.email)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="wrap foot-legal">
        <h2 className="sr-only">Licences and legal details</h2>
        <dl className="foot-dl">
          <div>
            <dt>Drug licence no.</dt>
            <dd>{legalValue(licences)}</dd>
          </div>
          <div>
            <dt>Registered pharmacist</dt>
            <dd>{legalValue(SITE_CONFIG.registeredPharmacist)}</dd>
          </div>
          <div>
            <dt>Grievance officer</dt>
            <dd>{legalValue(SITE_CONFIG.grievanceOfficer)}</dd>
          </div>
          <div>
            <dt>GSTIN</dt>
            <dd>{legalValue(SITE_CONFIG.gstin)}</dd>
          </div>
        </dl>
      </div>
      <div className="wrap foot-pay">
        <p className="foot-pay-label">Pay with</p>
        <ul className="pay">
          <li>UPI</li>
          <li>Cards</li>
          <li>Netbanking</li>
        </ul>
        <p>through Razorpay, or</p>
        <ul className="pay">
          <li>Cash on delivery</li>
        </ul>
      </div>
      <div className="wrap foot-base">
        <p>
          © {copyrightYear} {legalName}. Prescription medicines are dispensed only against a valid
          prescription.
        </p>
      </div>
    </footer>
  );
}
