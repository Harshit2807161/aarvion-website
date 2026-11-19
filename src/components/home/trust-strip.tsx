import { Icon, type IconName } from "@/components/base/icon";
import { SITE_CONFIG } from "@/config/site";

/**
 * The shipping-label trust strip. Copy is verbatim from the prototype except the last
 * subline, which is gated on `onlinePayments` (SITE_CONFIG): online payment stays hidden until
 * live Razorpay keys exist, so the strip must not offer it before then. Styles:
 * src/styles/quick-trust.css.
 */
export function TrustStrip({
  onlinePayments = SITE_CONFIG.onlinePayments,
}: {
  onlinePayments?: boolean;
}) {
  const items: readonly { icon: IconName; title: string; line: string }[] = [
    { icon: "shield", title: "Genuine medicines", line: "Straight from Aarvion" },
    { icon: "pharm", title: "Pharmacist-checked", line: "Every prescription, before packing" },
    { icon: "truck", title: "Free delivery", line: "Across India, on every order" },
    {
      icon: "cash",
      title: "Cash on delivery",
      line: onlinePayments ? "Or pay online with Razorpay" : "Pay when your order arrives",
    },
  ];
  return (
    <section className="trust wrap" aria-label="Why order from Aarvion">
      <ul className="trust-row">
        {items.map((it) => (
          <li key={it.title}>
            <Icon name={it.icon} size={28} />
            <p>
              <b>{it.title}</b>
              <span>{it.line}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
