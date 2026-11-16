import { MongoMemoryReplSet } from "mongodb-memory-server";
import { closeMongo, getDb } from "../../src/server/db/client";
import { resetEnvForTests } from "../../src/server/env";

let replSet: MongoMemoryReplSet | undefined;

const MEMBERS = 1;
/**
 * Fixed ports per Vitest worker, below every OS ephemeral range (macOS 49152+, Linux 32768+).
 * Left alone, mongodb-memory-server probes a random ephemeral port, closes it and has mongod
 * bind it later. Its "recently used" cache is per process, and int files run in parallel worker
 * processes, so another worker or any outbound socket can take the port in between ("Port …
 * already in use"). VITEST_POOL_ID (1..maxWorkers) is unique among running workers, and the
 * files in one worker run one after another, each stopping its replica set in afterAll.
 */
const BASE_PORT = 27_100;
const PORTS_PER_WORKER = 10;
/** A retry moves the block past every worker's first block (up to 20 workers). */
const RETRY_SHIFT = 200;
const MAX_RETRIES = 3;

function workerFirstPort(): number {
  const pool = Number(process.env.VITEST_POOL_ID ?? 1);
  return BASE_PORT + (Number.isInteger(pool) && pool > 0 ? pool - 1 : 0) * PORTS_PER_WORKER;
}

const portInUse = (err: unknown) =>
  err instanceof Error && /already in use|EADDRINUSE/i.test(err.message);

async function createReplSet(): Promise<MongoMemoryReplSet> {
  for (let retry = 0; ; retry++) {
    const first = workerFirstPort() + retry * RETRY_SHIFT;
    const rs = new MongoMemoryReplSet({
      replSet: { count: MEMBERS },
      // TTL monitor off: tests use fixed past clocks, which the background TTL sweep would otherwise delete.
      instanceOpts: Array.from({ length: MEMBERS }, (_, i) => ({
        port: first + i,
        args: ["--setParameter", "ttlMonitorEnabled=false"],
      })),
    });
    try {
      await rs.start();
      return rs;
    } catch (err) {
      // start() has already stopped the failed members, so a retry only needs a new block.
      if (retry >= MAX_RETRIES || !portInUse(err)) throw err;
    }
  }
}

/** Starts a 1-member in-memory replica set, points MONGODB_URI at it and resets cached state. */
export async function startMemoryReplSet(): Promise<string> {
  await closeMongo();
  replSet = await createReplSet();
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
