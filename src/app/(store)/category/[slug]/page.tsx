import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryView } from "@/components/catalogue/category-view";
import { getCachedCategories, getCachedCategory, getCachedProducts } from "@/lib/catalogue/cached";
import { assertCatalogue } from "@/lib/catalogue/errors";

type Props = { params: Promise<{ slug: string }> };

/** Every live and coming-soon category is prerendered; an empty catalogue fails the build [C11]. */
export async function generateStaticParams() {
  return assertCatalogue(await getCachedCategories()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCachedCategory(slug);
  if (!category) return { title: "Page not found" };
  if (category.status !== "live") return { title: `${category.name}: coming soon` };
  const n = (await getCachedProducts()).filter((p) => p.category === slug).length;
  return {
    title: category.name,
    description: `${n} ${category.name} medicines from Aarvion Pharmaceuticals. Each price is the MRP printed on the pack, less ₹20.`,
  };
}

/**
 * /category/<slug>: a live category's medicines in shelf order, or a coming-soon notice. A slug
 * that is unknown or hidden is a 404 (the store chrome comes from the root not-found). Reads the
 * cached catalogue only.
 */
export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCachedCategory(slug);
  if (!category) notFound();
  const [all, categories] = await Promise.all([getCachedProducts(), getCachedCategories()]);
  const products = category.status === "live" ? all.filter((p) => p.category === slug) : [];
  const others = categories.filter((c) => c.status === "live" && c.slug !== slug);
  return <CategoryView category={category} products={products} others={others} />;
}
