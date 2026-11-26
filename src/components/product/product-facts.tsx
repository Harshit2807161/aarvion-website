import { Rupees } from "@/components/base/rupees";
import { Fact } from "@/components/legal/legal-page";
import { SITE_CONFIG } from "@/config/site";
import { countryOfOrigin } from "@/lib/catalogue/origin";
import { packDisplay } from "@/lib/catalogue/display";
import type { PublicProduct } from "@/server/catalogue/queries";

export type FactsProduct = Pick<
  PublicProduct,
  "composition" | "dosageForm" | "packLabel" | "mrpPaise" | "manufacturer"
>;

/** Customer care as printed, only once both the phone and the email are supplied. */
function customerCare(): string | null {
  const care = SITE_CONFIG.customerCare;
  return care?.phone?.trim() && care.email?.trim() ? `${care.phone}, ${care.email}` : null;
}

/** The marketer line as printed: the legal name and the two address lines on one line. */
const MARKETER = `${SITE_CONFIG.legalName}, ${SITE_CONFIG.address.join(" ")}`;

/**
 * The Legal Metrology declarations every product page shows, as one definition list. A fact the
 * catalogue does not hold (the manufacturer of a pack not yet confirmed, and so its country of
 * origin) renders "To be added"; nothing is invented. Server-safe: no hooks, no live region.
 */
export function ProductFacts({ product }: { product: FactsProduct }) {
  return (
    <dl className="product-facts">
      <div>
        <dt>Composition</dt>
        <dd>
          <table>
            <thead>
              <tr>
                <th scope="col">Ingredient</th>
                <th scope="col">Strength</th>
              </tr>
            </thead>
            <tbody>
              {product.composition.map(({ ingredient, strength }, i) => (
                <tr key={`${i}-${ingredient}`}>
                  <th scope="row">{ingredient}</th>
                  <td>{strength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </dd>
      </div>
      <div>
        <dt>Dosage form</dt>
        <dd>{product.dosageForm}</dd>
      </div>
      <div>
        <dt>Net quantity</dt>
        <dd>{packDisplay(product)}</dd>
      </div>
      <div>
        <dt>MRP</dt>
        <dd>
          <span className="mono">
            <Rupees paise={product.mrpPaise} />
          </span>{" "}
          inclusive of all taxes
        </dd>
      </div>
      <div>
        <dt>Manufacturer</dt>
        <dd>
          <Fact value={product.manufacturer} />
        </dd>
      </div>
      <div>
        <dt>Marketer</dt>
        <dd>{MARKETER}</dd>
      </div>
      <div>
        <dt>Country of origin</dt>
        <dd>
          <Fact value={countryOfOrigin(product.manufacturer)} />
        </dd>
      </div>
      <div>
        <dt>Customer care</dt>
        <dd>
          <Fact value={customerCare()} />
        </dd>
      </div>
    </dl>
  );
}
