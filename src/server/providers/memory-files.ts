import type { FileStore } from "./types.ts";

export function createMemoryFiles(): FileStore {
  const store = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    async put(path, body, contentType) {
      store.set(path, { body: body.slice(), contentType });
    },
    async get(path) {
      const hit = store.get(path);
      return hit ? { body: hit.body.slice(), contentType: hit.contentType } : null;
    },
    async delete(path) {
      store.delete(path);
    },
  };
}
