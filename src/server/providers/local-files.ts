import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeKey, assertStoredType, assertWithinCap, FileExistsError } from "./file-keys.ts";
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
  // ENOTDIR: a parent segment of the key is a file, which also means "no such file".
  const isMissing = (err: unknown) => {
    const code = (err as { code?: string }).code;
    return code === "ENOENT" || code === "ENOTDIR";
  };

  return {
    kind: "local",
    async put(key, body, contentType) {
      const file = fileOf(key);
      assertStoredType(contentType);
      await mkdir(path.dirname(file), { recursive: true });
      try {
        // "wx" fails if the file exists: like Blob's allowOverwrite: false, never replace bytes.
        await writeFile(file, body, { flag: "wx" });
      } catch (err) {
        if ((err as { code?: string }).code === "EEXIST") throw new FileExistsError();
        throw err;
      }
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
