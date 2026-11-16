import type { Db, IndexDescription } from "mongodb";

const registry = new Map<string, IndexDescription[]>();

/** Modules register the indexes their collection needs; `ensureIndexes` applies them. */
export function registerIndexes(collection: string, specs: IndexDescription[]): void {
  registry.set(collection, [...(registry.get(collection) ?? []), ...specs]);
}

export function resetIndexRegistryForTests(): void {
  registry.clear();
}

function specName(spec: IndexDescription): string {
  if (spec.name) return spec.name;
  return Object.entries(spec.key as Record<string, unknown>)
    .map(([k, v]) => `${k}_${v}`)
    .join("_");
}

/** Idempotent and safe to run concurrently: only missing indexes are created. */
export async function ensureIndexes(db: Db): Promise<{ collection: string; created: string[] }[]> {
  const snapshot = [...registry.entries()].map(([name, specs]) => [name, [...specs]] as const);
  const results: { collection: string; created: string[] }[] = [];

  for (const [collection, specs] of snapshot) {
    const existing = new Set<string>();
    try {
      for (const idx of await db.collection(collection).indexes()) {
        if (idx.name) existing.add(idx.name);
      }
    } catch (err) {
      // NamespaceNotFound: the collection does not exist yet; createIndexes will make it.
      if ((err as { code?: number }).code !== 26) throw err;
    }
    const missing = specs.filter((s) => !existing.has(specName(s)));
    if (missing.length > 0) {
      await db
        .collection(collection)
        .createIndexes(missing.map((s) => ({ ...s, name: specName(s) })));
    }
    results.push({ collection, created: missing.map(specName) });
  }
  return results;
}
