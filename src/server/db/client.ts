import { MongoClient, type Db } from "mongodb";
import * as vercelFunctions from "@vercel/functions";
import { getEnv } from "../env.ts";

declare global {
  var __aarvionMongo: Promise<MongoClient> | undefined;
}

function attachPool(client: MongoClient): void {
  try {
    const attach = (vercelFunctions as { attachDatabasePool?: (pool: unknown) => void })
      .attachDatabasePool;
    if (typeof attach === "function") attach(client);
  } catch {
    // Not on Vercel (local, tests): pool lifecycle hooks are optional.
  }
}

/** Returns one shared client per process (cached on globalThis to survive HMR). */
export function getMongoClient(): Promise<MongoClient> {
  if (globalThis.__aarvionMongo) return globalThis.__aarvionMongo;

  const { MONGODB_URI } = getEnv();
  if (!MONGODB_URI) return Promise.reject(new Error("MONGODB_URI is not set"));

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 3000,
    maxPoolSize: 10,
    maxIdleTimeMS: 5000,
  });
  attachPool(client);

  const promise: Promise<MongoClient> = client.connect().then(
    () => client,
    async (err: unknown) => {
      // Do not cache failures: the next call builds a fresh client.
      if (globalThis.__aarvionMongo === promise) globalThis.__aarvionMongo = undefined;
      await client.close().catch(() => {});
      throw err;
    },
  );
  globalThis.__aarvionMongo = promise;
  return promise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getEnv().MONGODB_DB);
}

export async function closeMongo(): Promise<void> {
  const pending = globalThis.__aarvionMongo;
  globalThis.__aarvionMongo = undefined;
  if (!pending) return;
  try {
    const client = await pending;
    await client.close();
  } catch {
    // connect already failed and cleaned up after itself
  }
}
