import { Icon } from "@/components/base/icon";
import { SITE_CONFIG } from "@/config/site";

/**
 * "Questions": the home FAQ (spec C3), the six questions of design/prototype/src/index.src.html
 * (lines 238-268) in native `<details>`/`<summary>`: no script and no live region. The section id
 * `questions` and the item ids `faq-returns` and `faq-win2age` are link targets (ROUTES.questions,
 * ROUTES.faqWin2age, the footer and the policy pages); do not rename them. Styles are in
 * src/styles/faq-close.css.
 *
 * Copy that depends on what is true today is gated, never claimed:
 * - [C25] the first answer says every medicine is a prescription medicine only when the live
 *   catalogue is all Rx (`allRx`, from `homeModel`); otherwise "Medicines marked Rx need one."
 * - payment: online payment is named only when `SITE_CONFIG.onlinePayments` is true, and the
 *   rejected-prescription answer promises a refund only then (before that nothing is paid up front).
 */
export function Faq({
  allRx,
  onlinePayments = SITE_CONFIG.onlinePayments,
}: {
  allRx: boolean;
  onlinePayments?: boolean;
}) {
  const items: { id?: string; q: string; a: string }[] = [
    {
      q: "Do I need a prescription?",
      a: `${allRx ? "Yes. Every medicine here is a prescription medicine." : "Medicines marked Rx need one."} Upload a photo or PDF of a valid prescription, and a pharmacist checks it before your order is packed.`,
    },
    {
      q: "Can I reuse a prescription I uploaded before?",
      a: "Yes, as long as it is still valid. Pick it at checkout instead of uploading it again.",
    },
    {
      q: "How can I pay?",
      a: onlinePayments
        ? "Online through Razorpay, or cash on delivery for orders up to ₹5,000."
        : "Cash on delivery, for orders up to ₹5,000.",
    },
    {
      q: "What happens if my prescription is rejected?",
      a: onlinePayments
        ? "You pay when you place the order. If the pharmacist can’t approve the prescription, we tell you why by SMS or email and refund your payment."
        : "If the pharmacist can’t approve the prescription, we tell you why by SMS or email, and the order is not packed.",
    },
    {
      id: "faq-returns",
      q: "Can I cancel or return an order?",
      a: "You can cancel any time before the order is packed. Medicines can be returned only if they arrive damaged, wrong or expired.",
    },
    {
      id: "faq-win2age",
      q: "Why do some packs say Win2Age Pharma?",
      a: "Win2Age Pharma is Aarvion’s earlier marketing name. Some product photos still show packs printed under it until photos of the Aarvion packs are ready.",
    },
  ];
  return (
    <section className="faq" id="questions" aria-labelledby="faq-title">
      <div className="wrap faq-grid">
        <h2 className="h-section" id="faq-title">
          Questions
        </h2>
        <div className="faq-list">
          {items.map((item) => (
            <details key={item.q} id={item.id}>
              <summary>
                {item.q}
                <Icon name="chev" size={22} />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
