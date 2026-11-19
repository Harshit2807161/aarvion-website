/**
 * The official Aarvion logo, served from public/brand. `light` is the full-colour logo for
 * light ground; `reversed` is for forest ground. Do not redraw the logo or set it in text.
 */
export const BRAND_LOGO_SRC = {
  light: "/brand/aarvion-logo.svg",
  reversed: "/brand/aarvion-logo-reversed.svg",
} as const;

/**
 * Logo width / height (about 903 x 302). Provisional until the logo PR pins it to the SVG
 * viewBox. Keep the export name: that PR's brand-assets test imports it.
 */
export const BRAND_LOGO_RATIO = 3.0;

export function BrandMark({
  height,
  variant = "light",
  alt = "Aarvion",
  className,
  loading,
}: {
  /** Rendered height in px; the width follows from BRAND_LOGO_RATIO so the box never shifts. */
  height: number;
  variant?: keyof typeof BRAND_LOGO_SRC;
  /** Pass "" when the logo sits beside visible brand text, so it is not read twice. */
  alt?: string;
  className?: string;
  /**
   * "lazy" below the fold: React preloads every server-rendered eager `<img>`, which would queue
   * a footer logo ahead of the page's LCP image. Leave it unset above the fold (the header).
   */
  loading?: "lazy";
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG; next/image would not optimise it
    <img
      className={className}
      src={BRAND_LOGO_SRC[variant]}
      alt={alt}
      loading={loading}
      width={Math.round(height * BRAND_LOGO_RATIO)}
      height={height}
      style={{ aspectRatio: String(BRAND_LOGO_RATIO) }}
    />
  );
}
