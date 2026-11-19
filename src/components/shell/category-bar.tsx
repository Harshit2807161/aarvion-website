import Link from "next/link";
import { Icon } from "@/components/base/icon";
import { ROUTES } from "@/config/routes";
import type { Category } from "@/server/catalogue/schema";

/** What the bar needs of a category; `status` is optional so callers may pass live ones only. */
type BarCategory = Pick<Category, "slug" | "name"> & { status?: Category["status"] };

/**
 * The category bar under the store header: one link per live category, then "All medicines".
 * A server component. Pass categories in sortOrder (the cached catalogue already is); anything
 * not live is skipped here too, so a coming-soon category never gets a link to a page it has
 * not got. Category pages are pending (Task 30), so these links 404 until then.
 *
 * Desktop: a 44px bar that sticks under the header row. At 880px and below it becomes a row
 * of 36px outlined chips that scrolls away with the page (see src/styles/catbar.css). The
 * header's IntersectionObserver adds `is-stuck` to `.catbar`.
 */
export function CategoryBar({ categories }: { categories: readonly BarCategory[] }) {
  return (
    <nav className="catbar" aria-label="Shop by category">
      <ul className="wrap catbar-in">
        {categories
          .filter((c) => c.status === undefined || c.status === "live")
          .map((c) => (
            <li key={c.slug}>
              <Link href={ROUTES.category(c.slug)}>{c.name}</Link>
            </li>
          ))}
        <li>
          <Link href={ROUTES.medicines}>
            All medicines
            <Icon name="go" />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
