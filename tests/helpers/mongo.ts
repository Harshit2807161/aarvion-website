import { MongoMemoryReplSet } from "mongodb-memory-server";
import { closeMongo, getDb } from "../../src/server/db/client";
import { resetEnvForTests } from "../../src/server/env";

let replSet: MongoMemoryReplSet | undefined;

/** Starts a 1-member in-memory replica set, points MONGODB_URI at it and resets cached state. */
export async function startMemoryReplSet(): Promise<string> {
  await closeMongo();
  // TTL monitor off: tests use fixed past clocks, which the background TTL sweep would otherwise delete.
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ args: ["--setParameter", "ttlMonitorEnabled=false"] }],
  });
  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  resetEnvForTests();
  return uri;
}

export async function stopMemoryReplSet(): Promise<void> {
  await closeMongo();
  if (replSet) await replSet.stop();
  replSet = undefined;
  delete process.env.MONGODB_URI;
  resetEnvForTests();
}

/** Empties the named collections (for int tests that need a clean slate per case). */
export async function clearCollections(...names: string[]): Promise<void> {
  const db = await getDb();
  await Promise.all(names.map((n) => db.collection(n).deleteMany({})));
}
