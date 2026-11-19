import type { IconName } from "@/components/base/icon";
import { ROUTES } from "@/config/routes";
import { SITE_CONFIG, type SiteConfig } from "@/config/site";
import type { PublicProduct } from "@/server/catalogue/queries";

/** One home banner slide: a scene raster with live copy over it (v2 brief, home section 3). */
export type BannerSlide = {
  id: "sacuwin" | "eye" | "rx" | "delivery";
  /** Slugs of every pack the scene shows; the slide shows only while all of them are live. */
  needs: string[];
  title: string;
  line: string;
  cta: { label: string; href: string; icon: IconName };
  alt: string;
  /** The slide's short name in its dot's label, "Slide n: <dot>". */
  dot: string;
  /** The 1792 × 588 desktop master; next/image derives the smaller widths from it. */
  desktop: { src: string; width: 1792; height: 588 };
  /** The 840 × 472 phone crop, served through the picture's (max-width: 719px) source. */
  phone: { src: string; width: 840; height: 472 };
};

/** The two rasters of a scene in public/banners/ (Task 16, each with a provenance sidecar). */
const art = (id: BannerSlide["id"]) => ({
  desktop: { src: `/banners/${id}-1792.webp`, width: 1792, height: 588 } as const,
  phone: { src: `/banners/${id}-m.webp`, width: 840, height: 472 } as const,
});

/**
 * The delivery slide's payment line. The v2 brief says "Pay online or cash on delivery.", but
 * the store makes no online-payment claim while `onlinePayments` is off (as the footer does).
 */
export function deliveryLine(onlinePayments: boolean): string {
  return onlinePayments ? "Pay online or cash on delivery." : "Cash on delivery available.";
}

/** Every slide in its full order, copy verbatim from the v2 brief and index.src.html 61–118. */
export const BANNER_SLIDES: readonly BannerSlide[] = [
  {
    id: "sacuwin",
    needs: ["sacuwin-50", "sacuwin-100", "sacuwin-200"],
    title: "Sacuwin 50, 100 and 200",
    line: "Sacubitril and valsartan tablets in genuine Aarvion packs, delivered free.",
    cta: { label: "Shop Sacuwin", href: "#heart-care", icon: "arrow" },
    alt: "Sacuwin 50, 100 and 200 packs on green and white pedestals, misty hills behind",
    dot: "Sacuwin",
    ...art("sacuwin"),
  },
  {
    id: "eye",
    needs: ["hyloage", "sysnet-ultra", "caftop", "oloage-kt"],
    title: "Eye drops, delivered to your door",
    line: "Hyloage, Sysnet Ultra, Caftop and Oloage-KT.",
    cta: { label: "Shop eye care", href: "#eye-care", icon: "arrow" },
    alt: "Hyloage, Caftop, Sysnet Ultra and Oloage-KT eye drop packs on two stone pedestals",
    dot: "Eye drops",
    ...art("eye"),
  },
  {
    id: "rx",
    needs: [],
    title: "Upload your prescription",
    line: "A pharmacist checks it before your order is packed.",
    cta: { label: "Upload prescription", href: ROUTES.uploadRx, icon: "upload" },
    alt: "A blank prescription sheet, a phone and a pen on a sunlit desk",
    dot: "Upload your prescription",
    ...art("rx"),
  },
  {
    id: "delivery",
    needs: [],
    title: "Free delivery anywhere in India",
    line: deliveryLine(SITE_CONFIG.onlinePayments),
    cta: { label: "Browse all medicines", href: "#medicines", icon: "arrow" },
    alt: "A parcel tied with a green band waiting at a front door",
    dot: "Free delivery",
    ...art("delivery"),
  },
];

/**
 * The slides to show for the live catalogue, in order (plan ruling "Banner fallback"). A slide
 * shows only while every pack it names is in `products` (the public catalogue: active, in a live
 * category); prescription and delivery always show. Only Sacuwin's packs are Aarvion-printed, so
 * without the Sacuwin slide prescription leads and eye moves last: a Win2Age pack never leads.
 * The first slide returned is the page's LCP image.
 */
export function bannerSlides(
  products: readonly Pick<PublicProduct, "slug">[],
  config: Pick<SiteConfig, "onlinePayments"> = SITE_CONFIG,
): BannerSlide[] {
  const live = new Set(products.map((p) => p.slug));
  const shown = BANNER_SLIDES.filter((s) => s.needs.every((slug) => live.has(slug))).map((s) =>
    s.id === "delivery" ? { ...s, line: deliveryLine(config.onlinePayments) } : s,
  );
  const order: BannerSlide["id"][] = shown.some((s) => s.id === "sacuwin")
    ? ["sacuwin", "eye", "rx", "delivery"]
    : ["rx", "delivery", "eye"];
  return order.flatMap((id) => shown.filter((s) => s.id === id));
}
