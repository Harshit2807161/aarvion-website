import { MongoMemoryReplSet } from "mongodb-memory-server";
import { closeMongo } from "../../src/server/db/client";
import { resetEnvForTests } from "../../src/server/env";

let replSet: MongoMemoryReplSet | undefined;

/** Starts a 1-member in-memory replica set, points MONGODB_URI at it and resets cached state. */
export async function startMemoryReplSet(): Promise<string> {
  await closeMongo();
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
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
