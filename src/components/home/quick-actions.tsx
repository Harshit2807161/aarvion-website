import Link from "next/link";
import { Icon, type IconName } from "@/components/base/icon";
import { ROUTES } from "@/config/routes";

type Action = {
  icon: IconName;
  title: string;
  line: string;
  href: string;
  /** The search card jumps to the header search field (`id="q"`, store-header.tsx). */
  search?: boolean;
  /** The prescription card sits on forest. */
  rx?: boolean;
};

const ACTIONS: readonly Action[] = [
  {
    icon: "file",
    title: "Order with a prescription",
    line: "Upload a photo or PDF",
    href: ROUTES.uploadRx,
    rx: true,
  },
  {
    icon: "search",
    title: "Search for a medicine",
    line: "By brand, salt or strength",
    href: "#q",
    search: true,
  },
  { icon: "box", title: "Track an order", line: "See where your order is", href: ROUTES.account },
  { icon: "chat", title: "Contact us", line: "Address and support details", href: ROUTES.contact },
];

/**
 * The four quick-action cards under the hero banner. Copy is verbatim from the prototype
 * (design/prototype/src/index.src.html). The prescription card is a plain link to the
 * prescriptions page; the prototype's inline file picker is not ported. Styles:
 * src/styles/quick-trust.css.
 */
export function QuickActions() {
  return (
    <section className="quick wrap" aria-label="Quick actions">
      <ul className="qa-grid">
        {ACTIONS.map((a) => (
          <li className="qa-cell" key={a.title}>
            <Link
              className={a.rx ? "qa qa--rx" : "qa"}
              href={a.href}
              {...(a.search ? { "data-search": "" } : {})}
            >
              <span className="qa-well">
                <Icon name={a.icon} size={22} />
              </span>
              <span className="qa-text">
                <span className="qa-title">{a.title}</span>
                <span className="qa-line">{a.line}</span>
              </span>
              <Icon name="go" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
