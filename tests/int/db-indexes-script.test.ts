import { spawnSync } from "node:child_process";
import { MongoClient } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

let uri: string;
beforeAll(async () => {
  uri = await startMemoryReplSet();
}, 120_000);
afterAll(stopMemoryReplSet);

// Runs the real `pnpm db:indexes` exactly as a deploy step would.
function runIndexes() {
  return spawnSync("pnpm", ["db:indexes"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, MONGODB_URI: uri, MONGODB_DB: "indexes_script_test" },
  });
}

describe("pnpm db:indexes", () => {
  it("applies indexes, and is idempotent on a second run", async () => {
    const first = runIndexes();
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("dev_outbox: created");

    const second = runIndexes();
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain("dev_outbox: up to date");

    const client = await MongoClient.connect(uri);
    try {
      const indexes = await client.db("indexes_script_test").collection("dev_outbox").indexes();
      const ttl = indexes.find((i) => i.name === "expiresAt_1");
      expect(ttl?.expireAfterSeconds).toBe(0);
    } finally {
      await client.close();
    }
  });
});
