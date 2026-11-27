import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertSafeKey, FileTooLargeError } from "./file-keys.ts";
import { createLocalFiles } from "./local-files.ts";
import { createMemoryFiles } from "./memory-files.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "aarv-files-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("assertSafeKey", () => {
  it.each(["rx/0123abcd/9f8e.webp", "rx-staging/abc/AbC_-12", "rx/a/b.pdf"])("accepts %s", (k) => {
    expect(() => assertSafeKey(k)).not.toThrow();
  });
  it.each([
    "../x",
    "/rx/a",
    "rx/a/../b",
    "rx",
    "rx/",
    "rx//a",
    "rx/a.txt",
    "Rx/a",
    "rx/a\u0000b",
    "rx/a/b.webp/c",
  ])("refuses %j", (k) => {
    expect(() => assertSafeKey(k)).toThrow(/unsafe file key/);
  });
});

describe("local file store", () => {
  it("round-trips bytes and content type, then deletes", async () => {
    const files = createLocalFiles(dir);
    expect(files.kind).toBe("local");
    await files.put("rx/u1/r1.webp", new Uint8Array([1, 2, 3]), "image/webp");
    expect(readFileSync(path.join(dir, "rx/u1/r1.webp"))).toEqual(Buffer.from([1, 2, 3]));
    expect(await files.get("rx/u1/r1.webp")).toEqual({
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/webp",
    });
    await files.delete("rx/u1/r1.webp");
    expect(await files.get("rx/u1/r1.webp")).toBeNull();
    await expect(files.delete("rx/u1/r1.webp")).resolves.toBeUndefined();
  });

  it("returns null for a missing key", async () => {
    expect(await createLocalFiles(dir).get("rx/nobody/none.pdf")).toBeNull();
  });

  it("throws FileTooLargeError over maxBytes and returns the file at exactly maxBytes", async () => {
    const files = createLocalFiles(dir);
    await files.put("rx/u1/big.pdf", new Uint8Array(10), "application/pdf");
    expect((await files.get("rx/u1/big.pdf", { maxBytes: 10 }))?.body.byteLength).toBe(10);
    const err = await files.get("rx/u1/big.pdf", { maxBytes: 9 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FileTooLargeError);
    expect((err as Error).name).toBe("FileTooLargeError");
  });

  it("refuses unsafe keys before touching the disk", async () => {
    const files = createLocalFiles(dir);
    await expect(files.put("../x", new Uint8Array(1), "image/webp")).rejects.toThrow(/unsafe/);
    await expect(files.get("rx/a/../b")).rejects.toThrow(/unsafe/);
    await expect(files.delete("/rx/a")).rejects.toThrow(/unsafe/);
  });
});

describe("memory file store", () => {
  it("is kind memory, checks keys and honours maxBytes", async () => {
    const files = createMemoryFiles();
    expect(files.kind).toBe("memory");
    await expect(files.put("../x", new Uint8Array(1), "image/webp")).rejects.toThrow(/unsafe/);
    await files.put("rx/u/a.webp", new Uint8Array(5), "image/webp");
    await expect(files.get("rx/u/a.webp", { maxBytes: 4 })).rejects.toBeInstanceOf(
      FileTooLargeError,
    );
  });
});
