import { getImageProps } from "next/image";
import { ButtonLink } from "@/components/base/button";
import { Icon } from "@/components/base/icon";
import { cn } from "@/lib/cn";
import { bannerSlides, type BannerSlide } from "@/lib/catalogue/banners";
import { getCachedProducts } from "@/lib/catalogue/cached";
import { BannerCarousel } from "./banner-carousel";
import { PHONE_QUERY } from "./carousel";

/** Phones show 86vw cards; desktop shows the 1280px content column less its gutters. */
const DESKTOP_SIZES = "(max-width: 719px) 86vw, min(1280px, 100vw - 80px)";

/**
 * A scene as an art-directed picture (plan ruling: banners use `getImageProps` for the phone
 * `<source>`): the 840 × 472 phone crop below 720px, else the 1792 master. Both carry their
 * dimensions, so neither layout shifts. The lead slide's image is the LCP: eager with
 * fetchPriority high, never `preload` [C24]. Slides 2 to 4 are lazy and carry their sources as
 * `data-src` / `data-srcset`: even a lazy image is fetched before `load` when it sits in or near
 * the viewport (the stacked desktop slides, the phone row's peeking card), which would queue it
 * behind the LCP image. `useCarousel` moves them to `src` / `srcset` and makes them eager after
 * window load (`revealSlideImages`).
 */
function SlidePicture({ slide, lead }: { slide: BannerSlide; lead: boolean }) {
  const phone = getImageProps({ ...slide.phone, quality: 70, sizes: "86vw", alt: "" }).props;
  const { props: img } = getImageProps({
    ...slide.desktop,
    quality: 75,
    sizes: DESKTOP_SIZES,
    alt: slide.alt,
    loading: lead ? "eager" : "lazy",
    fetchPriority: lead ? "high" : undefined,
  });
  const { src, srcSet, ...rest } = img;
  const imgAttrs = lead
    ? img
    : ({ ...rest, "data-src": src, "data-srcset": srcSet } as unknown as typeof img);
  const sourceAttrs = lead ? { srcSet: phone.srcSet } : { "data-srcset": phone.srcSet };
  return (
    <>
      <picture className="slide-img">
        <source
          media={PHONE_QUERY}
          {...sourceAttrs}
          sizes={phone.sizes}
          width={slide.phone.width}
          height={slide.phone.height}
        />
        <img {...imgAttrs} alt={slide.alt} />
      </picture>
      {!lead && (
        // Without JS nothing reveals the data-* sources, and a phone's scroll-snap row still lets
        // the visitor swipe to this card, so it gets a plain picture here. With JS on, the
        // content of `noscript` is inert text: no request, so the budget holds.
        <noscript>
          <picture className="slide-img">
            <source
              media={PHONE_QUERY}
              srcSet={phone.srcSet}
              sizes={phone.sizes}
              width={slide.phone.width}
              height={slide.phone.height}
            />
            <img {...img} alt={slide.alt} />
          </picture>
        </noscript>
      )}
    </>
  );
}

/** One slide: the picture, then its live heading, line and forest button. */
function Slide({ slide, n, count }: { slide: BannerSlide; n: number; count: number }) {
  const { cta } = slide;
  // As in the prototype, an arrow follows the label; the upload icon leads it.
  const trailing = cta.icon === "arrow";
  return (
    <div
      // Slide 1 is current in the server markup so it shows before hydration; from then on
      // useCarousel owns is-current (React never re-renders these server-rendered slides).
      className={cn("slide", `slide--${slide.id}`, n === 1 && "is-current")}
      role="group"
      aria-roledescription="slide"
      aria-label={`${n} of ${count}`}
    >
      <SlidePicture slide={slide} lead={n === 1} />
      <div className="slide-copy">
        <h2 className="slide-title">{slide.title}</h2>
        <p className="slide-line">{slide.line}</p>
        <ButtonLink variant="forest" href={cta.href} icon={trailing ? undefined : cta.icon}>
          <span>{cta.label}</span>
          {trailing && <Icon name={cta.icon} size={18} />}
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * The home hero banner, the owner's "hero banner which keeps changing" (v2 brief, home
 * section 3). A server component: it picks the slides for the live catalogue with
 * `bannerSlides` (the banner fallback), so the first visible slide is the LCP, and hands them
 * to the client `BannerCarousel` as children. Its 1280px width comes from the page root's
 * `.home` (src/styles/quick-trust.css).
 */
export async function HeroBanner() {
  const slides = bannerSlides(await getCachedProducts());
  return (
    <BannerCarousel slides={slides.map(({ id, dot }) => ({ id, dot }))}>
      {slides.map((slide, i) => (
        <Slide key={slide.id} slide={slide} n={i + 1} count={slides.length} />
      ))}
    </BannerCarousel>
  );
}
