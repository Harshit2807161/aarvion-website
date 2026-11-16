import { getEnv, type Env } from "../env.ts";

/** The production database name. Production sets MONGODB_DB to this (docs/decisions/environments.md). */
export const PRODUCTION_DB_NAME = "aarvion_prod";

const URI_DB_PATH = /^mongodb(?:\+srv)?:\/\/[^/]*\/([^?]*)/;

function uriDatabase(uri: string | undefined): string | undefined {
  const raw = uri ? URI_DB_PATH.exec(uri)?.[1] : undefined;
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** True when MONGODB_DB or the database in the MONGODB_URI path is the production one (any case). */
export function targetsProductionDb(env: Pick<Env, "MONGODB_URI" | "MONGODB_DB">): boolean {
  return [env.MONGODB_DB, uriDatabase(env.MONGODB_URI)].some(
    (name) => name?.toLowerCase() === PRODUCTION_DB_NAME,
  );
}

/** Single source of truth: true when mocks and dev-only tools must be refused. */
export function isMockForbidden(): boolean {
  const env = getEnv();
  return (
    env.VERCEL_ENV === "production" ||
    (env.NODE_ENV === "production" && env.ALLOW_MOCKS_IN_PROD_BUILD !== "1") ||
    targetsProductionDb(env)
  );
}
