import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";

/**
 * Prescription file fixtures, all built in code (no binaries committed). Used by the file-check
 * tests and by the upload tests that follow. Images are flat colour, so they encode small.
 */
const flat = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 180, b: 160 } } });

/** A JPEG with EXIF (Make) and orientation 6, so a 1200 x 1600 file displays as 1600 x 1200. */
export async function jpegWithExif(width = 1200, height = 1600): Promise<Uint8Array> {
  return flat(width, height)
    .jpeg()
    .withMetadata({ exif: { IFD0: { Make: "Test" } }, orientation: 6 })
    .toBuffer();
}

export async function png(width: number, height: number): Promise<Uint8Array> {
  return flat(width, height).png().toBuffer();
}

/** A two-frame animated WebP of 500 x 500 frames. */
export async function animatedWebp(): Promise<Uint8Array> {
  const frame = (r: number) =>
    sharp({ create: { width: 500, height: 500, channels: 3, background: { r, g: 0, b: 0 } } })
      .png()
      .toBuffer();
  return sharp([await frame(255), await frame(0)], { join: { animated: true } })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
}

/** HTML bytes (what a file named photo.jpg may really be). */
export function htmlAsJpgName(): Uint8Array {
  return new TextEncoder().encode("<!doctype html><html><script>alert(1)</script></html>");
}

/** A valid JPEG with `payload` appended after its end-of-image marker. */
export async function jpegWithTrailer(payload: string): Promise<Uint8Array> {
  return Buffer.concat([await flat(800, 800).jpeg().toBuffer(), Buffer.from(payload, "latin1")]);
}

/**
 * A 1-bit grey PNG of `side` x `side`: tiny on disk (zeros deflate to almost nothing), huge once
 * decoded. At 20,000 x 20,000 it is a 400 MP pixel bomb.
 */
export function pixelBombPng(side: number): Uint8Array {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(body));
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr.set([1, 0, 0, 0, 0], 8); // 1-bit, greyscale, deflate, adaptive filter, no interlace
  const rows = Buffer.alloc(side * (Math.ceil(side / 8) + 1));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
