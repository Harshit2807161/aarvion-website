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
/** A small PDF of `pages` pages; `extra` goes into the catalog dictionary. */
export function pdf({
  pages = 1,
  extra = "",
}: { pages?: number; extra?: string } = {}): Uint8Array {
  const kids = Array.from({ length: pages }, (_, i) => `${3 + i} 0 R`).join(" ");
  const leaves = Array.from(
    { length: pages },
    (_, i) => `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\n`,
  ).join("");
  const text =
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R ${extra} >>\nendobj\n` +
    `2 0 obj\n<< /Type /Pages /Count ${pages} /Kids [${kids}] >>\nendobj\n${leaves}` +
    `trailer\n<< /Root 1 0 R /Size ${3 + pages} >>\nstartxref\n0\n%%EOF\n`;
  return Buffer.from(text, "latin1");
}

/** Pad a PDF to exactly `size` bytes with a comment line after the header, keeping %%EOF last. */
export function padPdf(bytes: Uint8Array, size: number): Uint8Array {
  const header = 9; // "%PDF-1.4\n"
  const fill = size - bytes.length;
  const comment = Buffer.from(`%${"x".repeat(fill - 2)}\n`, "latin1");
  return Buffer.concat([bytes.subarray(0, header), comment, bytes.subarray(header)]);
}

/**
 * A PDF 1.5 whose page tree sits in a compressed `/Type /ObjStm`: the Pages dictionary (with
 * `/Count`) and `leaves` page objects are inside the stream, the catalog is outside. `decoys`
 * plain `/Type /Page` objects sit outside it, `inner` adds one more object inside, `filter` is
 * the stream filter, and `data` replaces the stream bytes (to test bad or oversized data).
 */
export function objStmPdf({
  leaves = 2,
  count = leaves,
  decoys = 0,
  inner = "",
  filter = "/FlateDecode",
  data,
}: {
  leaves?: number;
  count?: number;
  decoys?: number;
  inner?: string;
  filter?: string;
  data?: Buffer;
} = {}): Uint8Array {
  const kids = Array.from({ length: leaves }, (_, i) => `${3 + i} 0 R`).join(" ");
  const objs = [
    `<< /Type /Pages /Count ${count} /Kids [${kids}] >>`,
    ...Array.from({ length: leaves }, () => "<< /Type /Page /Parent 2 0 R >>"),
    ...(inner ? [inner] : []),
  ];
  let body = "";
  const pairs: string[] = [];
  objs.forEach((o, i) => {
    pairs.push(`${i === 0 ? 2 : 2 + i} ${body.length}`);
    body += `${o}\n`;
  });
  const head = `${pairs.join(" ")}\n`;
  const stream = data ?? deflateSync(Buffer.from(head + body, "latin1"));
  const plain = Array.from(
    { length: decoys },
    (_, i) => `${50 + i} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n`,
  ).join("");
  return Buffer.concat([
    Buffer.from(
      `%PDF-1.5\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n${plain}` +
        `20 0 obj\n<< /Type /ObjStm /N ${objs.length} /First ${head.length} /Filter ${filter} /Length ${stream.length} >>\nstream\n`,
      "latin1",
    ),
    stream,
    Buffer.from("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n", "latin1"),
  ]);
}
