"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A category bar link that marks itself `aria-current="page"` when the shopper is on that path.
 * It is the bar's only client piece; the bar itself stays a server component, and the same
 * links are the 880px chip row (src/styles/catbar.css), so the chips carry it too.
 */
export function CategoryBarLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link href={href} aria-current={pathname === href ? "page" : undefined}>
      {children}
    </Link>
  );
}
