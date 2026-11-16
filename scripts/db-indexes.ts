// Run with: pnpm db:indexes (tsx, so tsconfig `@/` paths and type imports resolve like app code).
import { closeMongo, getDb } from "../src/server/db/client.ts";
import { ensureIndexes } from "../src/server/db/indexes.ts";
import "../src/server/db/register-all.ts";

async function main() {
  try {
    const results = await ensureIndexes(await getDb());
    if (results.length === 0) console.log("No indexes registered.");
    for (const r of results) {
      console.log(
        `${r.collection}: ${r.created.length ? `created ${r.created.join(", ")}` : "up to date"}`,
      );
    }
  } finally {
    await closeMongo();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
