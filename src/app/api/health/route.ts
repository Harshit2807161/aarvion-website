import pkg from "../../../../package.json";
import { getDb } from "@/server/db/client";
import { EnvError, getEnv } from "@/server/env";
import { isMockForbidden } from "@/server/providers/guard";

export const dynamic = "force-dynamic";

const PING_CAP_MS = 3500;

async function pingDb(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ping = (async () => {
      const db = await getDb();
      await db.command({ ping: 1 });
      return true;
    })();
    ping.catch(() => {});
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), PING_CAP_MS);
    });
    return await Promise.race([ping, timeout]);
  } catch (err) {
    // Log the error name only: driver messages can embed connection details.
    console.error("health: db ping failed", err instanceof Error ? err.name : "unknown");
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const version = pkg.version;
  let uri: string | undefined;
  let productionLike: boolean;
  try {
    uri = getEnv().MONGODB_URI;
    // "Production-like" reuses the mock guard: VERCEL_ENV=production, or a production build
    // without ALLOW_MOCKS_IN_PROD_BUILD. The e2e build sets that flag, so it counts as
    // non-production here and keeps the db-less smoke test green.
    productionLike = isMockForbidden();
  } catch (err) {
    // EnvError messages hold key names only, never received values.
    if (err instanceof EnvError) console.error("health: invalid environment", err.message);
    else console.error("health: unexpected error", err instanceof Error ? err.name : "unknown");
    return Response.json({ status: "error", version, db: "misconfigured" }, { status: 503 });
  }
  if (!uri) {
    if (productionLike) {
      return Response.json({ status: "error", version, db: "unconfigured" }, { status: 503 });
    }
    return Response.json({ status: "ok", version, db: "skipped" });
  }
  if (await pingDb()) {
    return Response.json({ status: "ok", version, db: "ok" });
  }
  return Response.json({ status: "degraded", version, db: "down" }, { status: 503 });
}
