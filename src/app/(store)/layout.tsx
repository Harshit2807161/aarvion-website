import { StoreFooter } from "@/components/shell/store-footer";
import { getCachedCategories } from "@/lib/catalogue/cached";

/** Layout for every customer-facing route: the page, then the store footer. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Read at build time (cached, tagged `catalogue`): the build needs a seeded database.
  const live = (await getCachedCategories()).filter((c) => c.status === "live");
  return (
    <>
      {children}
      <StoreFooter categories={live} />
    </>
  );
}
