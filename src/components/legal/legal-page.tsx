import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OperateShell } from "@/components/shell/operate-shell";
import { LEGAL_PLACEHOLDER, POLICY_VERSION } from "@/config/site";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * "2026-11-17" → "17 November 2026". String maths only, never `Intl` or `Date`, so the server
 * and the browser print the same words in every locale and time zone.
 */
export function formatPolicyDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

/** A legal fact the owner has not supplied yet: the "To be added" chip. */
export function Pending() {
  return <span className="pending">{LEGAL_PLACEHOLDER}</span>;
}

/** A fact from SITE_CONFIG: the value once supplied, the Pending chip while it is unset. */
export function Fact({ value }: { value: string | null | undefined }) {
  return value?.trim() ? <>{value}</> : <Pending />;
}

/**
 * Page metadata for a policy. The title stays plain: the UI plan's SEO task gives the root
 * layout the "%s · Aarvion Pharmaceuticals" template, which adds the site name.
 */
export function legalMetadata(title: string, description: string): Metadata {
  return { title, description };
}

/** One numbered part of a policy: an h2 over its paragraphs and lists. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/**
 * The layout of every policy page: the Operate shell (title and sub in the forest band), then
 * the policy as one reading column on the white sheet, opening with the date the copy was last
 * changed (POLICY_VERSION; bump it when a policy changes in substance).
 */
export function LegalPage({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <OperateShell title={title} sub={sub}>
      <article className="prose">
        <p className="prose-updated">
          Last updated <time dateTime={POLICY_VERSION}>{formatPolicyDate(POLICY_VERSION)}</time>
        </p>
        {children}
      </article>
    </OperateShell>
  );
}
