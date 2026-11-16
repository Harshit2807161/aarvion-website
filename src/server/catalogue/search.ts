import type { Product } from "./schema.ts";

export const MAX_QUERY_LENGTH = 64;

/** NFKD, strip combining marks, lowercase, every non-[a-z0-9] run becomes one space. */
export function normaliseSearchText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Literal tokens of a user query. Never used to build a regex. */
export function queryTokens(q: string): string[] {
  return normaliseSearchText(q).slice(0, MAX_QUERY_LENGTH).split(" ").filter(Boolean);
}

export function matchesTokens(
  p: Pick<Product, "name" | "familySlug" | "composition">,
  tokens: string[],
): boolean {
  const haystack = normaliseSearchText(
    [p.name, p.familySlug, ...p.composition.map((c) => c.ingredient)].join(" "),
  ).replaceAll(" ", "");
  return tokens.every((t) => haystack.includes(t));
}
