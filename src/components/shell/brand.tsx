import Link from "next/link";
import { BrandMark } from "@/components/base/brand-mark";
import { ROUTES } from "@/config/routes";

/**
 * The brand lockup. The official logo already carries the wordmark and has no
 * "PHARMACEUTICALS" line, so the legal name appears in the address and copyright instead.
 * `header`: a home link on white ground. `foot`: the reversed logo on forest, not a link.
 */
export function Brand({ variant }: { variant: "header" | "foot" }) {
  if (variant === "header") {
    return (
      <Link className="brand" href={ROUTES.home} aria-label="Aarvion Pharmaceuticals, home">
        <BrandMark height={40} alt="" className="brand-logo" />
      </Link>
    );
  }
  return (
    <p className="foot-logo">
      <BrandMark height={52} variant="reversed" alt="Aarvion" />
    </p>
  );
}
