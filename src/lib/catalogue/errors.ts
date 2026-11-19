import { getEnv } from "@/server/env";

function databaseName(): string {
  try {
    return `MONGODB_DB "${getEnv().MONGODB_DB}"`;
  } catch {
    return "MONGODB_DB";
  }
}

/** Fail closed: the build never deploys an empty storefront (docs/decisions/environments.md). */
export class CatalogueEmptyError extends Error {
  constructor() {
    super(
      `The catalogue in ${databaseName()} is empty. Seed it before building: ` +
        "run `pnpm db:indexes && pnpm seed` with this build's MONGODB_URI and MONGODB_DB.",
    );
    this.name = "CatalogueEmptyError";
  }
}

/** Returns `items`, or throws CatalogueEmptyError when there are none (for generateStaticParams). */
export function assertCatalogue<T>(items: T[]): T[] {
  if (items.length === 0) throw new CatalogueEmptyError();
  return items;
}
