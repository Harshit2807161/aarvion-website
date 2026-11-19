import { BrandMark } from "@/components/base/brand-mark";

/**
 * The footer brand: the official reversed logo on forest ground. The logo already carries the
 * wordmark and has no "PHARMACEUTICALS" line, so the legal name appears in the address and the
 * copyright instead. The header lockup is added with the header task, when something uses it.
 */
export function Brand() {
  return (
    <p className="foot-logo">
      <BrandMark height={52} variant="reversed" alt="Aarvion" />
    </p>
  );
}
