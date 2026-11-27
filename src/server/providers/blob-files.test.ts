import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", async (orig) => ({ ...(await orig<object>()), ...sdk }));

import { createBlobFiles } from "./blob-files.ts";
import { BlobError } from "@vercel/blob";
import { FileExistsError, FileTooLargeError } from "./file-keys.ts";

const token = "vercel_blob_rw_test_not_a_secret";

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(ch);
      c.close();
    },
  });
}

beforeEach(() => {
  sdk.put.mockReset().mockResolvedValue({ pathname: "rx/u/a.webp" });
  sdk.get.mockReset();
  sdk.del.mockReset().mockResolvedValue(undefined);
});

describe("Vercel Blob file store", () => {
  it("puts privately, without a random suffix or overwrite, with the token", async () => {
    const files = createBlobFiles({ token });
    expect(files.kind).toBe("blob");
    await files.put("rx/u/a.webp", new Uint8Array([7, 8]), "image/webp");
    expect(sdk.put).toHaveBeenCalledTimes(1);
    const [key, body, opts] = sdk.put.mock.calls[0]!;
    expect(key).toBe("rx/u/a.webp");
    expect(Buffer.from(body as Buffer)).toEqual(Buffer.from([7, 8]));
    expect(opts).toEqual({
      access: "private",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: false,
      token,
    });
  });

  it("gets privately from origin and reads the whole stream", async () => {
    sdk.get.mockResolvedValue({
      statusCode: 200,
      stream: streamOf([new Uint8Array([1, 2]), new Uint8Array([3])]),
      blob: { contentType: "application/pdf", size: 3 },
    });
    const files = createBlobFiles({ token });
    expect(await files.get("rx/u/a.pdf")).toEqual({
      body: new Uint8Array([1, 2, 3]),
      contentType: "application/pdf",
    });
    expect(sdk.get).toHaveBeenCalledWith("rx/u/a.pdf", {
      access: "private",
      useCache: false,
      token,
    });
  });

  it("returns null for a missing blob", async () => {
    sdk.get.mockResolvedValue(null);
    expect(await createBlobFiles({ token }).get("rx/u/none.pdf")).toBeNull();
  });

  it("throws FileTooLargeError when the stream passes maxBytes", async () => {
    const mib = 1024 * 1024;
    const chunk = new Uint8Array(mib);
    sdk.get.mockResolvedValue({
      statusCode: 200,
      stream: streamOf(Array.from({ length: 9 }, () => chunk)),
      blob: { contentType: "application/pdf", size: 9 * mib },
    });
    await expect(
      createBlobFiles({ token }).get("rx/u/big.pdf", { maxBytes: 8 * mib }),
    ).rejects.toBeInstanceOf(FileTooLargeError);
  });

  it("deletes by pathname with the token, and refuses unsafe keys without calling the SDK", async () => {
    const files = createBlobFiles({ token });
    await files.delete("rx/u/a.webp");
    expect(sdk.del).toHaveBeenCalledWith("rx/u/a.webp", { token });
    await expect(files.put("../a", new Uint8Array(1), "image/webp")).rejects.toThrow(/unsafe/);
    await expect(files.get("/rx/a")).rejects.toThrow(/unsafe/);
    expect(sdk.put).toHaveBeenCalledTimes(0);
    expect(sdk.get).toHaveBeenCalledTimes(0);
  });

  it("maps the SDK's already-exists refusal to FileExistsError, and passes other errors through", async () => {
    const files = createBlobFiles({ token });
    sdk.put.mockRejectedValueOnce(
      new BlobError(
        "This blob already exists, use `allowOverwrite: true` if you want to overwrite it.",
      ),
    );
    await expect(files.put("rx/u/a.webp", new Uint8Array(1), "image/webp")).rejects.toBeInstanceOf(
      FileExistsError,
    );
    sdk.put.mockRejectedValueOnce(new BlobError("The blob service is currently not available."));
    const other = await files
      .put("rx/u/b.webp", new Uint8Array(1), "image/webp")
      .catch((e: unknown) => e);
    expect(other).toBeInstanceOf(BlobError);
    expect(other).not.toBeInstanceOf(FileExistsError);
  });

  it("refuses an unsupported content type and a blob over maxBytes by its size, before streaming", async () => {
    const files = createBlobFiles({ token });
    await expect(files.put("rx/u/a.webp", new Uint8Array(1), "text/html")).rejects.toThrow(
      /unsupported stored content type/,
    );
    const cancel = vi.fn();
    sdk.get.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream({ cancel }),
      blob: { contentType: "application/pdf", size: 9 },
    });
    await expect(files.get("rx/u/a.pdf", { maxBytes: 8 })).rejects.toBeInstanceOf(
      FileTooLargeError,
    );
    expect(cancel).toHaveBeenCalled();
  });
});
