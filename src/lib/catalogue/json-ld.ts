import { ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";
import type { Metadata } from "next";
import { formatRupees } from "@/lib/format/rupees";
import { sellingPricePaise } from "@/server/catalogue/pricing";
import type { PublicProduct } from "@/server/catalogue/queries";
import { actives, fullComposition } from "./display";

export type ProductJsonLd = {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  sku: string;
  image: string[];
  description: string;
  brand: { "@type": "Brand"; name: string };
  manufacturer?: { "@type": "Organization"; name: string };
  offers: {
    "@type": "Offer";
    url: string;
    priceCurrency: "INR";
    price: string;
    itemCondition: "https://schema.org/NewCondition";
  };
};

/**
 * schema.org Product data for a product page. Only what the catalogue states: the price is our
 * selling price (MRP less the flat discount), the manufacturer is named only when the catalogue
 * has one, and there is deliberately no `availability`, `aggregateRating` or `review`: we hold no
 * stock feed and no reviews, and an unbacked claim in structured data is worse than none.
 */
export function productJsonLd(p: PublicProduct, base: URL): ProductJsonLd {
  const maker = p.manufacturer?.split(", ")[0]?.trim();
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.slug,
    image: p.images.map((i) => new URL(i.src, base).href),
    description: `${fullComposition(p.composition)}. ${p.packLabel}.`,
    brand: { "@type": "Brand", name: SITE_CONFIG.legalName },
    ...(maker ? { manufacturer: { "@type": "Organization" as const, name: maker } } : {}),
    offers: {
      "@type": "Offer",
      url: new URL(ROUTES.product(p.slug), base).href,
      priceCurrency: "INR",
      price: (sellingPricePaise(p.mrpPaise) / 100).toFixed(2),
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

/** JSON for an inline `<script type="application/ld+json">`: `<` is escaped so no value can close it. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * A product page's title, description, canonical URL and share image. The title is the name and
 * the actives with their strengths; the description states the MRP and our price (never the
 * discount as a lead) and, for a prescription product, that a pharmacist checks every order.
 * The root layout's template adds "· Aarvion Pharmaceuticals".
 */
export function productMetadata(p: PublicProduct): Metadata {
  const activeText = actives(p.composition)
    .map((a) => `${a.name} ${a.strength}`.replace(/\u00a0/g, " "))
    .join(" + ");
  const price = formatRupees(sellingPricePaise(p.mrpPaise));
  const rx = p.rxRequired ? " Needs a valid prescription; a pharmacist checks every order." : "";
  const photo = p.images[0]!;
  return {
    title: `${p.name}, ${activeText}`,
    description: `MRP ${formatRupees(p.mrpPaise)}, our price ${price}. ${p.packLabel}.${rx}`,
    alternates: { canonical: ROUTES.product(p.slug) },
    openGraph: {
      images: [{ url: photo.src, width: photo.width, height: photo.height, alt: photo.alt }],
    },
  };
}
