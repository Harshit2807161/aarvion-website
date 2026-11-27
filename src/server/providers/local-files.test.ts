import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RX_MAX_BYTES } from "../prescriptions/file-check.ts";
import {
  assertSafeKey,
  assertStoredType,
  DEFAULT_MAX_READ_BYTES,
  FileExistsError,
  FileTooLargeError,
} from "./file-keys.ts";
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

describe("content types and the default read cap", () => {
  it.each(["image/webp", "application/pdf", "application/octet-stream"])("accepts %s", (t) => {
    expect(() => assertStoredType(t)).not.toThrow();
  });
  it.each(["text/html", "image/svg+xml", "image/jpeg", ""])("refuses %j", (t) => {
    expect(() => assertStoredType(t)).toThrow(/unsupported stored content type/);
  });
  it("defaults reads to the prescription file cap", () => {
    expect(DEFAULT_MAX_READ_BYTES).toBe(RX_MAX_BYTES);
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

  it("returns null for a missing key, also when a parent segment is a file", async () => {
    const files = createLocalFiles(dir);
    expect(await files.get("rx/nobody/none.pdf")).toBeNull();
    await files.put("rx-staging/u1/s1", new Uint8Array([1]), "application/octet-stream");
    expect(await files.get("rx-staging/u1/s1/x")).toBeNull();
  });

  it("refuses a put to an existing key with FileExistsError and keeps the first bytes", async () => {
    const files = createLocalFiles(dir);
    await files.put("rx/u1/r1.webp", new Uint8Array([1]), "image/webp");
    const err = await files
      .put("rx/u1/r1.webp", new Uint8Array([2]), "image/webp")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FileExistsError);
    expect((err as Error).name).toBe("FileExistsError");
    expect((await files.get("rx/u1/r1.webp"))?.body).toEqual(new Uint8Array([1]));
  });

  it("refuses an unsupported content type before writing", async () => {
    const files = createLocalFiles(dir);
    await expect(files.put("rx/u1/x.webp", new Uint8Array(1), "text/html")).rejects.toThrow(
      /unsupported stored content type/,
    );
    expect(await files.get("rx/u1/x.webp")).toBeNull();
  });

  it("caps a read at the default cap when no maxBytes is given", async () => {
    const files = createLocalFiles(dir);
    await files.put(
      "rx/u1/huge.pdf",
      new Uint8Array(DEFAULT_MAX_READ_BYTES + 1),
      "application/pdf",
    );
    await expect(files.get("rx/u1/huge.pdf")).rejects.toBeInstanceOf(FileTooLargeError);
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
  it("refuses a put to an existing key with FileExistsError", async () => {
    const files = createMemoryFiles();
    await files.put("rx/u/a.webp", new Uint8Array([1]), "image/webp");
    await expect(
      files.put("rx/u/a.webp", new Uint8Array([2]), "image/webp"),
    ).rejects.toBeInstanceOf(FileExistsError);
    expect((await files.get("rx/u/a.webp"))?.body).toEqual(new Uint8Array([1]));
    await expect(files.put("rx/u/b.webp", new Uint8Array(1), "text/html")).rejects.toThrow(
      /unsupported stored content type/,
    );
  });

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
