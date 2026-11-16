// Run with: node --experimental-strip-types --no-warnings scripts/db-indexes.ts
import { closeMongo, getDb } from "../src/server/db/client.ts";
import { ensureIndexes } from "../src/server/db/indexes.ts";
import "../src/server/db/register-all.ts";

try {
  const results = await ensureIndexes(await getDb());
  if (results.length === 0) console.log("No indexes registered.");
  for (const r of results) {
    console.log(`${r.collection}: ${r.created.length ? `created ${r.created.join(", ")}` : "up to date"}`);
  }
} finally {
  await closeMongo();
}
