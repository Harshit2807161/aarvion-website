import pkg from "../../../../package.json";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";

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
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const version = pkg.version;
  if (!getEnv().MONGODB_URI) {
    return Response.json({ status: "ok", version, db: "skipped" });
  }
  if (await pingDb()) {
    return Response.json({ status: "ok", version, db: "ok" });
  }
  return Response.json({ status: "degraded", version, db: "down" }, { status: 503 });
}
