import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/product/product-view";
import { fullComposition, packDisplay } from "@/lib/catalogue/display";
import {
  getCachedCategory,
  getCachedFamily,
  getCachedProduct,
  getCachedProducts,
} from "@/lib/catalogue/cached";
import { assertCatalogue } from "@/lib/catalogue/errors";

/** Related packs on a product page: the same category, not this pack, at most four. */
const RELATED_MAX = 4;

/** Every public product is prerendered; an empty catalogue fails the build [C11]. */
export async function generateStaticParams() {
  return assertCatalogue(await getCachedProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const product = await getCachedProduct((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: `${product.name}: ${fullComposition(product.composition)}. ${packDisplay(product)}.`,
  };
}

/** /product/<slug>: an unknown, inactive or not-live slug is a 404. */
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getCachedProduct((await params).slug);
  if (!product) notFound();
  const [family, category, all] = await Promise.all([
    getCachedFamily(product.familySlug),
    getCachedCategory(product.category),
    getCachedProducts(),
  ]);
  if (!category) notFound();
  const related = all
    .filter((p) => p.category === product.category && p.slug !== product.slug)
    .slice(0, RELATED_MAX);
  return <ProductView product={product} family={family} category={category} related={related} />;
}
