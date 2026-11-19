/** Official logo files in public/brand: `light` on light ground, `reversed` on forest. */
export const BRAND_LOGO_SRC = {
  light: "/brand/aarvion-logo.svg",
  reversed: "/brand/aarvion-logo-reversed.svg",
} as const;

/** Logo width / height (about 903 x 302). Provisional until pinned to the SVG viewBox. */
export const BRAND_LOGO_RATIO = 3.0;

export function BrandMark({
  height,
  variant = "light",
  alt = "Aarvion",
  className,
}: {
  /** Rendered height in px; width follows BRAND_LOGO_RATIO so the box never shifts. */
  height: number;
  variant?: keyof typeof BRAND_LOGO_SRC;
  /** "" when the logo sits beside visible brand text. */
  alt?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG; next/image would not optimise it
    <img
      className={className}
      src={BRAND_LOGO_SRC[variant]}
      alt={alt}
      width={Math.round(height * BRAND_LOGO_RATIO)}
      height={height}
      style={{ aspectRatio: String(BRAND_LOGO_RATIO) }}
    />
  );
}
