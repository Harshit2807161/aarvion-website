import Link from "next/link";
import { BrandMark } from "@/components/base/brand-mark";
import { ROUTES } from "@/config/routes";

/**
 * The Aarvion logo lockup. The logo already carries the wordmark and has no "PHARMACEUTICALS"
 * line, so the legal name appears in the address and the copyright instead.
 *
 * - `footer` (default): the official reversed logo on forest ground.
 * - `header`: the full-colour logo on white, a home link (the link carries the name, so the
 *   image's alt is empty). Its height is CSS (`.brand-logo`: 40px, 34px on phones); the
 *   width/height attributes only reserve the box.
 */
export function Brand({ placement = "footer" }: { placement?: "footer" | "header" }) {
  if (placement === "header") {
    return (
      <Link className="brand" href={ROUTES.home} aria-label="Aarvion Pharmaceuticals, home">
        <BrandMark className="brand-logo" height={40} variant="light" alt="" />
      </Link>
    );
  }
  return (
    <p className="foot-logo">
      <BrandMark height={52} variant="reversed" alt="Aarvion" />
    </p>
  );
}
