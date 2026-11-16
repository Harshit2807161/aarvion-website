import type { Db, IndexDescription } from "mongodb";

export type NamedIndex = IndexDescription & { name: string };

const registry = new Map<string, NamedIndex[]>();

/** Modules register the indexes their collection needs; `ensureIndexes` applies them. */
export function registerIndexes(collection: string, specs: NamedIndex[]): void {
  const current = registry.get(collection) ?? [];
  const next = [...current];
  for (const spec of specs) {
    if (typeof spec.name !== "string" || spec.name === "") {
      throw new Error(`Index on "${collection}" needs an explicit name`);
    }
    const prior = next.find((s) => s.name === spec.name);
    if (!prior) {
      next.push(spec);
    } else if (JSON.stringify(prior) !== JSON.stringify(spec)) {
      throw new Error(`Index "${spec.name}" is already registered on "${collection}"`);
    }
  }
  registry.set(collection, next);
}

export function getRegisteredIndexes(collection: string): readonly NamedIndex[] {
  return registry.get(collection) ?? [];
}

export function resetIndexRegistryForTests(): void {
  registry.clear();
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
    const missing = specs.filter((s) => !existing.has(s.name));
    if (missing.length > 0) {
      await db.collection(collection).createIndexes(missing);
    }
    results.push({ collection, created: missing.map((s) => s.name) });
  }
  return results;
}
