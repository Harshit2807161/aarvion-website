import { afterEach, describe, expect, it, vi } from "vitest";
import { RX_IMAGE_MIN_SIDE, RX_MAX_BYTES } from "@/server/prescriptions/file-check";
import {
  prepareRxFile,
  RX_UPLOAD_MAX_BYTES,
  RX_UPLOAD_MAX_SIDE,
  RX_UPLOAD_MIN_SIDE,
} from "./prepare-file.ts";
import { fileSize, RX_COPY } from "./rx-copy.ts";

const MB = 1_048_576;

function fileOf(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

/** A decoded bitmap of the given size, and a canvas that records what it was asked to draw. */
function stubCanvas(width: number, height: number, encodedBytes = 400_000) {
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width, height, close })),
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() }),
    toBlob: vi.fn((cb: (b: Blob | null) => void, type: string, quality: number) => {
      expect(quality).toBe(0.85);
      cb(new Blob([new Uint8Array(encodedBytes)], { type }));
    }),
  };
  vi.stubGlobal("document", { createElement: () => canvas });
  return { canvas, close };
}

afterEach(() => vi.unstubAllGlobals());

describe("prepareRxFile", () => {
  it("pins the size cap and the minimum side to the server's", () => {
    expect(RX_UPLOAD_MAX_BYTES).toBe(RX_MAX_BYTES);
    expect(RX_UPLOAD_MIN_SIDE).toBe(RX_IMAGE_MIN_SIDE);
  });

  it("never shrinks the short side below the server's minimum (a long, narrow page)", async () => {
    const { canvas } = stubCanvas(1000, 8000);
    const r = await prepareRxFile(fileOf("long.jpg", "image/jpeg", 3 * MB));
    expect(r.ok && r.blob.type).toBe("image/jpeg");
    expect(canvas.width).toBe(RX_UPLOAD_MIN_SIDE);
    expect(canvas.height).toBe(3200);
  });

  it("refuses a type it cannot use, by name", async () => {
    expect(await prepareRxFile(fileOf("setup.exe", "application/x-msdownload", 10))).toEqual({
      ok: false,
      message: RX_COPY.unsupported("setup.exe"),
    });
  });

  it("refuses a 9 MB PDF as too large, with its size", async () => {
    const r = await prepareRxFile(fileOf("rx.pdf", "application/pdf", 9 * MB));
    expect(r).toEqual({ ok: false, message: RX_COPY.tooLarge("rx.pdf", "9.0 MB") });
    expect(fileSize(9 * MB)).toBe("9.0 MB");
  });

  it("sends a PDF as is, and labels one found by its extension", async () => {
    const pdf = fileOf("rx.pdf", "application/pdf", 2000);
    expect(await prepareRxFile(pdf)).toEqual({ ok: true, blob: pdf, kind: "pdf" });
    const r = await prepareRxFile(fileOf("RX.PDF", "", 2000));
    expect(r.ok && r.blob.type).toBe("application/pdf");
  });

  it("re-encodes a 3 MB JPEG to a JPEG at most 2560 px long", async () => {
    const { canvas, close } = stubCanvas(4000, 3000);
    const r = await prepareRxFile(fileOf("photo.jpg", "image/jpeg", 3 * MB));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kind).toBe("image");
    expect(r.blob.type).toBe("image/jpeg");
    expect(r.blob.size).toBe(400_000);
    expect(Math.max(canvas.width, canvas.height)).toBe(RX_UPLOAD_MAX_SIDE);
    expect(canvas.height).toBe(1920);
    expect(close).toHaveBeenCalledOnce();
  });

  it("re-encodes a small file that is too long on one side", async () => {
    const { canvas } = stubCanvas(1200, 4000);
    const r = await prepareRxFile(fileOf("long.png", "image/png", 300_000));
    expect(r.ok && r.blob.type).toBe("image/jpeg");
    expect(canvas.height).toBe(RX_UPLOAD_MAX_SIDE);
  });

  it("sends a 200 KB PNG of 1000 px unchanged", async () => {
    const { canvas } = stubCanvas(1000, 800);
    const png = fileOf("scan.png", "image/png", 200_000);
    expect(await prepareRxFile(png)).toEqual({ ok: true, blob: png, kind: "image" });
    expect(canvas.toBlob).not.toHaveBeenCalled();
  });

  it("always converts a HEIC photo, which the server does not take", async () => {
    stubCanvas(1000, 800);
    const r = await prepareRxFile(fileOf("IMG_1.HEIC", "image/heic", 200_000));
    expect(r.ok && r.blob.type).toBe("image/jpeg");
  });

  it("sends the original when decoding fails and the type is allowed, else refuses", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode");
      }),
    );
    const jpg = fileOf("a.jpg", "image/jpeg", 3 * MB);
    expect(await prepareRxFile(jpg)).toEqual({ ok: true, blob: jpg, kind: "image" });
    expect(await prepareRxFile(fileOf("b.heic", "image/heic", 3 * MB))).toEqual({
      ok: false,
      message: RX_COPY.unsupported("b.heic"),
    });
  });

  it("refuses a re-encoded photo that is still over 8 MB", async () => {
    stubCanvas(6000, 4000, 9 * MB);
    const r = await prepareRxFile(fileOf("huge.jpg", "image/jpeg", 20 * MB));
    expect(r).toEqual({ ok: false, message: RX_COPY.tooLarge("huge.jpg", "9.0 MB") });
  });
});
