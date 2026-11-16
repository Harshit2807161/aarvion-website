import { getEnv } from "../env.ts";

/** Single source of truth: true when mocks and dev-only tools must be refused. */
export function isMockForbidden(): boolean {
  const env = getEnv();
  return (
    env.VERCEL_ENV === "production" ||
    (env.NODE_ENV === "production" && env.ALLOW_MOCKS_IN_PROD_BUILD !== "1")
  );
}
