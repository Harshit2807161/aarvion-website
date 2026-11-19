import { ROUTES } from "@/config/routes";
import { compareVariants } from "@/server/catalogue/order";
import type { PublicProduct } from "@/server/catalogue/queries";

type Strength = Pick<PublicProduct, "slug" | "name" | "variantLabel">;

/**
 * The other strengths of a medicine as plain links to their own pages, in shelf order. Renders
 * only for a family of two or more. The current strength is marked `aria-current="page"`.
 * Server-safe and script-free: choosing a strength is a navigation, so nothing is announced here.
 */
export function VariantSwitcher({
  family,
  current,
}: {
  family: readonly Strength[];
  current: Strength;
}) {
  if (family.length < 2) return null;
  // Not toSorted(): missing in Firefox 111-114, which Next 16 still targets.
  const ordered = [...family].sort(compareVariants);
  return (
    <nav className="strengths" aria-label="Strengths">
      {ordered.map((v) => (
        <a
          key={v.slug}
          className="strength-chip mono"
          href={ROUTES.product(v.slug)}
          aria-current={v.slug === current.slug ? "page" : undefined}
        >
          {v.variantLabel ?? v.name}
        </a>
      ))}
    </nav>
  );
}
