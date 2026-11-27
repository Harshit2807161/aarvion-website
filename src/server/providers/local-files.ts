import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeKey, assertWithinCap } from "./file-keys.ts";
import type { FileStore } from "./types.ts";

/**
 * Disk store for `pnpm dev` (FILE_STORE=local), so uploads survive a restart. Each file is
 * `<dir>/<key>` with its content type in `<dir>/<key>.type`. Refused on Vercel and in production.
 */
export function createLocalFiles(dir: string): FileStore {
  const root = path.resolve(dir);
  const fileOf = (key: string) => {
    assertSafeKey(key);
    return path.join(root, key);
  };
  const isMissing = (err: unknown) => (err as { code?: string }).code === "ENOENT";

  return {
    kind: "local",
    async put(key, body, contentType) {
      const file = fileOf(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
      await writeFile(`${file}.type`, contentType);
    },
    async get(key, opts) {
      const file = fileOf(key);
      try {
        assertWithinCap((await stat(file)).size, opts?.maxBytes);
        const [body, contentType] = await Promise.all([
          readFile(file),
          readFile(`${file}.type`, "utf8"),
        ]);
        return { body: new Uint8Array(body), contentType };
      } catch (err) {
        if (isMissing(err)) return null;
        throw err;
      }
    },
    async delete(key) {
      const file = fileOf(key);
      await rm(file, { force: true });
      await rm(`${file}.type`, { force: true });
    },
  };
}
