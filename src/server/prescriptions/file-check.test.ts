import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  animatedWebp,
  htmlAsJpgName,
  jpegWithExif,
  jpegWithTrailer,
  padPdf,
  pdf,
  pixelBombPng,
  png,
} from "../../../tests/helpers/rx-fixtures";
import { RX_MAX_BYTES, checkRxFile, scanPdf, sniffType } from "./file-check";

const text = (s: string) => new TextEncoder().encode(s);
const bytesOf = (b: Uint8Array) => Buffer.from(b);

describe("sniffType", () => {
  it.each([
    ["jpeg", [0xff, 0xd8, 0xff, 0xe0]],
    ["png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["webp", [...text("RIFF"), 0, 0, 0, 0, ...text("WEBP")]],
    ["pdf", [...text("%PDF-1.7")]],
    ["pdf", [...text("%PDF-2.0")]],
    [null, [...text("%PDF-1.8")]],
    [null, [...text("%PDF-3.0")]],
    [null, [...text("GIF89a")]],
    [null, [...text("RIFF"), 0, 0, 0, 0, ...text("WAVE")]],
    [null, []],
  ])("reads %s from the bytes", (kind, bytes) => {
    expect(sniffType(Uint8Array.from(bytes))).toBe(kind);
  });
});

describe("checkRxFile: images", () => {
  it("re-encodes a JPEG to WebP, applies the EXIF rotation and drops all metadata", async () => {
    const r = await checkRxFile(await jpegWithExif(1200, 1600));
    if (!r.ok) throw new Error(r.error);
    expect(r.file).toMatchObject({
      contentType: "image/webp",
      ext: "webp",
      kind: "image",
      pages: 1,
    });
    expect([r.file.width, r.file.height]).toEqual([1600, 1200]);
    const meta = await sharp(bytesOf(r.file.body)).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([1600, 1200]);
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
  });

  it("shrinks a 4000 x 3000 PNG to a longest side of 3000, never enlarging", async () => {
    const r = await checkRxFile(await png(4000, 3000));
    if (!r.ok) throw new Error(r.error);
    expect([r.file.width, r.file.height]).toEqual([3000, 2250]);
    const small = await checkRxFile(await png(900, 600));
    if (!small.ok) throw new Error(small.error);
    expect([small.file.width, small.file.height]).toEqual([900, 600]);
  });

  it("refuses an image whose shortest side is under 400", async () => {
    expect(await checkRxFile(await png(300, 900))).toEqual({ ok: false, error: "too_small" });
  });

  it("re-encodes away bytes appended after the JPEG end marker", async () => {
    const r = await checkRxFile(await jpegWithTrailer("<script>alert(1)</script>"));
    if (!r.ok) throw new Error(r.error);
    expect(Buffer.from(r.file.body).includes("<script>")).toBe(false);
  });

  it("refuses a 20,000 x 20,000 pixel bomb as corrupt", async () => {
    expect(await checkRxFile(pixelBombPng(20_000))).toEqual({ ok: false, error: "corrupt" });
  });

  it("refuses an animated WebP", async () => {
    expect(await checkRxFile(await animatedWebp())).toEqual({ ok: false, error: "animated" });
  });

  it("refuses a truncated image as corrupt", async () => {
    const whole = await png(800, 800);
    expect(await checkRxFile(whole.subarray(0, 60))).toEqual({ ok: false, error: "corrupt" });
  });
});

describe("checkRxFile: type and size", () => {
  it.each([
    ["HTML named .jpg", htmlAsJpgName()],
    ["SVG", text('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ["GIF89a", text("GIF89a\u0001\u0000\u0001\u0000")],
  ])("refuses %s as unsupported_type", async (_n, bytes) => {
    expect(await checkRxFile(bytes)).toEqual({ ok: false, error: "unsupported_type" });
  });

  it("accepts a PDF of exactly 8 MiB and refuses one byte more or no bytes", async () => {
    const ok = await checkRxFile(padPdf(pdf(), RX_MAX_BYTES));
    expect(ok.ok).toBe(true);
    expect(await checkRxFile(padPdf(pdf(), RX_MAX_BYTES + 1))).toEqual({
      ok: false,
      error: "too_large",
    });
    expect(await checkRxFile(new Uint8Array())).toEqual({ ok: false, error: "empty" });
  });
});

describe("checkRxFile and scanPdf: PDFs", () => {
  it("keeps a 2-page PDF byte for byte", async () => {
    const input = pdf({ pages: 2 });
    const r = await checkRxFile(input);
    if (!r.ok) throw new Error(r.error);
    expect(r.file).toMatchObject({
      contentType: "application/pdf",
      ext: "pdf",
      kind: "pdf",
      pages: 2,
      width: null,
      height: null,
    });
    expect(Buffer.from(r.file.body).equals(Buffer.from(input))).toBe(true);
  });

  it.each([
    [
      "a hex-escaped /JS in /OpenAction",
      "/OpenAction << /S /J#53 (app.alert(1)) >>",
      "active_content",
    ],
    ["/JavaScript", "/AA << /O << /S /JavaScript /JS (x) >> >>", "active_content"],
    ["/Launch", "/OpenAction << /S /Launch >>", "active_content"],
    ["an embedded file", "/Names << /EmbeddedFiles 9 0 R >>", "active_content"],
    ["/XFA", "/AcroForm << /XFA [] >>", "active_content"],
    ["/Encrypt", "/Encrypt 5 0 R", "encrypted"],
    ["a hex-escaped /Encrypt", "/Encr#79pt 5 0 R", "encrypted"],
  ])("refuses %s", async (_n, extra, error) => {
    expect(await checkRxFile(pdf({ extra }))).toEqual({ ok: false, error });
  });

  it("does not match a longer name that only starts with a blocked one", () => {
    expect(scanPdf(pdf({ extra: "/JSONData 1 0 R /Launchpad 2 0 R" }))).toEqual({
      ok: true,
      pages: 1,
    });
  });

  it("refuses 21 pages and accepts 20", async () => {
    expect(await checkRxFile(pdf({ pages: 21 }))).toEqual({ ok: false, error: "too_many_pages" });
    expect((await checkRxFile(pdf({ pages: 20 }))).ok).toBe(true);
  });

  it("refuses a PDF with no %%EOF in its last 1024 bytes, or with no pages", async () => {
    const noEof = Buffer.from(pdf()).toString("latin1").replace("%%EOF", "");
    expect(await checkRxFile(text(noEof))).toEqual({ ok: false, error: "corrupt" });
    const farEof = Buffer.concat([pdf(), Buffer.alloc(2000, 0x20)]);
    expect(await checkRxFile(farEof)).toEqual({ ok: false, error: "corrupt" });
    expect(await checkRxFile(pdf({ pages: 0 }))).toEqual({ ok: false, error: "corrupt" });
  });
});

describe("checkRxFile: sha256", () => {
  it("is the hex digest of the stored body, for an image and for a PDF", async () => {
    for (const input of [await png(800, 800), pdf()]) {
      const r = await checkRxFile(input);
      if (!r.ok) throw new Error(r.error);
      expect(r.file.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(r.file.sha256).toBe(createHash("sha256").update(r.file.body).digest("hex"));
    }
  });
});
