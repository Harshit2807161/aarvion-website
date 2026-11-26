import Link from "next/link";
import { ButtonLink } from "@/components/base/button";
import { OperateShell } from "@/components/shell/operate-shell";
import { ROUTES } from "@/config/routes";
import { countWord } from "@/lib/catalogue/display";
import type { PublicProduct } from "@/server/catalogue/queries";
import type { Category } from "@/server/catalogue/schema";
import { Pocket } from "./pocket";

/**
 * The category page body (/category/<slug>), inside the Operate shell: a forest band with the
 * shopper's name for the category, then either a wrapping sheet of pockets on print-field foil
 * (a live category) or a dashed "adding soon" panel (coming soon), then quiet links to the other
 * live categories. Names are the owner's shopper names (Heart care, Eye care ...), never a
 * therapy area. `products` are already in shelf order and empty for a category that is not live.
 * The first pocket is the page's LCP candidate, so it alone gets `priority` [C24].
 * Styles: src/styles/category.css.
 */
export function CategoryView({
  category,
  products,
  others,
}: {
  category: Pick<Category, "slug" | "name" | "status">;
  products: readonly PublicProduct[];
  others: readonly Pick<Category, "slug" | "name">[];
}) {
  const live = category.status === "live";
  const n = products.length;
  const sub = live
    ? `${countWord(n)} ${n === 1 ? "medicine" : "medicines"}. Each price is the MRP printed on the pack, less ₹20.`
    : "Coming soon";
  return (
    <OperateShell
      title={category.name}
      sub={sub}
      back={{ href: ROUTES.medicines, label: "All medicines" }}
    >
      {live ? (
        <div className="cat-strip">
          <ul className="cat-grid">
            {products.map((p, i) => (
              <Pocket key={p.slug} product={p} heading="h2" priority={i === 0} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="cat-soon">
          <p>
            We’re adding {category.name} medicines to the store. Until then, browse the medicines
            available now.
          </p>
          <ButtonLink variant="forest" href={ROUTES.medicines}>
            Browse medicines
          </ButtonLink>
        </div>
      )}
      {others.length > 0 && (
        <nav className="cat-others" aria-labelledby="cat-others-title">
          <h2 className="cat-others-title" id="cat-others-title">
            Other categories
          </h2>
          <ul>
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={ROUTES.category(o.slug)}>{o.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </OperateShell>
  );
}
