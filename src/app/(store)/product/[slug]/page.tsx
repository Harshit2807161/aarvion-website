import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/product/product-view";
import {
  getCachedCategory,
  getCachedFamily,
  getCachedProduct,
  getCachedProducts,
} from "@/lib/catalogue/cached";
import { assertCatalogue } from "@/lib/catalogue/errors";
import { jsonLdScript, productJsonLd, productMetadata } from "@/lib/catalogue/json-ld";
import { siteUrl } from "@/lib/site-url";

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
  return product ? productMetadata(product) : {};
}

/**
 * Wait for the static result of a slug that was not prerendered, so `notFound()` runs before the
 * response starts and the first hit is a real 404 (Cache Components otherwise streams the shell
 * first and answers 200). It needs every read in the route tree to be cached.
 */
export const ensureStatic = "navigation";

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
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd(product, siteUrl())) }}
      />
      <ProductView product={product} family={family} category={category} related={related} />
    </>
  );
}
