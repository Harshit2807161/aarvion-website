import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdf } from "../../../tests/helpers/rx-fixtures";
import { PDF_SCAN_TIMEOUT_MS, scanPdf } from "./pdf-scan";

const refused = (error: string) => ({ ok: false, error });
const FIXTURES = path.resolve(import.meta.dirname, "../../../tests/fixtures/rx");
const text = (s: string) => Buffer.from(s, "latin1");

describe("scanPdf: what is allowed", () => {
  it("counts the pages of a plain PDF and of one pdf-lib wrote with object streams", async () => {
    expect(await scanPdf(pdf({ pages: 2 }))).toEqual({ ok: true, pages: 2 });
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) doc.addPage();
    const withStreams = await doc.save({ useObjectStreams: true });
    expect(Buffer.from(withStreams).includes("/ObjStm")).toBe(true);
    expect(await scanPdf(withStreams)).toEqual({ ok: true, pages: 3 });
  });

  it("accepts 20 pages, a link action, and a longer name that only starts with a refused one", async () => {
    expect(await scanPdf(pdf({ pages: 20 }))).toEqual({ ok: true, pages: 20 });
    expect(
      await scanPdf(pdf({ extra: "/Annots [<< /A << /S /URI /URI (https://example.com) >> >>]" })),
    ).toEqual({ ok: true, pages: 1 });
    expect(await scanPdf(pdf({ extra: "/JSONData 1 0 R /Launchpad 2 0 R" }))).toEqual({
      ok: true,
      pages: 1,
    });
  });
});

describe("scanPdf: refused by the parse, not by a pattern", () => {
  it.each([
    ["/JS", "/Names << /JavaScript 1 0 R >>"],
    ["a hex-escaped /JS", "/Names << /J#53 (app.alert(1)) >>"],
    ["/OpenAction", "/OpenAction << /S /GoTo /D [3 0 R /Fit] >>"],
    ["/AA", "/AA << /O 9 0 R >>"],
    ["/Launch", "/X << /Launch << /F (calc.exe) >> >>"],
    ["an action whose /S is Launch", "/X << /S /Launch >>"],
    ["an action whose /S is GoToR", "/X << /S /GoToR /F (x) >>"],
    ["an action whose /S is SubmitForm", "/X << /S /SubmitForm >>"],
    ["an action whose /S is ImportData", "/X << /S /ImportData >>"],
    ["/RichMedia", "/X << /RichMedia 1 0 R >>"],
    ["/EmbeddedFile", "/X << /EmbeddedFile 1 0 R >>"],
    ["/EmbeddedFiles", "/Names << /EmbeddedFiles 1 0 R >>"],
    ["/XFA", "/AcroForm << /XFA [] >>"],
    ["/Thread", "/X << /Thread 1 0 R >>"],
    ["an action whose /S is Sound", "/X << /S /Sound >>"],
    ["/Movie", "/X << /Movie 1 0 R >>"],
    ["/Rendition", "/X << /Rendition 1 0 R >>"],
    ["a key hidden inside an array of dictionaries", "/X [1 [<< /JS (x) >>]]"],
  ])("refuses %s", async (_n, extra) => {
    expect(await scanPdf(pdf({ extra }))).toEqual(refused("active_content"));
  });

  it("refuses an encrypted PDF, and any /Encrypt key", async () => {
    expect(await scanPdf(pdf({ encrypt: true }))).toEqual(refused("encrypted"));
    expect(await scanPdf(pdf({ extra: "/Encrypt 5 0 R" }))).toEqual(refused("encrypted"));
  });

  it("refuses 21 pages, no pages, no %%EOF, garbage and an empty input", async () => {
    expect(await scanPdf(pdf({ pages: 21 }))).toEqual(refused("too_many_pages"));
    expect(await scanPdf(pdf({ pages: 0 }))).toEqual(refused("corrupt"));
    const noEof = Buffer.from(pdf()).toString("latin1").replace("%%EOF", "");
    expect(await scanPdf(text(noEof))).toEqual(refused("corrupt"));
    expect(await scanPdf(text("%PDF-1.4\n this is not a pdf %%EOF\n"))).toEqual(refused("corrupt"));
    expect(await scanPdf(new Uint8Array())).toEqual(refused("corrupt"));
  });
});

describe("scanPdf: the reviewed attack files", () => {
  const attacks = readdirSync(FIXTURES).filter((f) => f.startsWith("objstm-"));

  it("has the object-stream attack files", () => {
    expect(attacks.length).toBeGreaterThanOrEqual(12);
  });

  // Each holds a JavaScript OpenAction in a compressed object stream, hidden by a trick (a key
  // or string containing "obj", a padded dictionary, an odd EOL after `stream`, a wrong /Length,
  // a hex-escaped /Type); poppler reports JavaScript for every one.
  it.each(attacks)("refuses %s", async (file) => {
    const r = await scanPdf(readFileSync(path.join(FIXTURES, file)));
    expect(r.ok).toBe(false);
  });

  it.each(["25-untyped-leaves-Count-1.pdf", "25-untyped-leaves-no-Count.pdf"])(
    "does not take %s as a small PDF",
    async (file) => {
      const r = await scanPdf(readFileSync(path.join(FIXTURES, file)));
      expect(r.ok && r.pages <= 20).toBe(false);
    },
  );
});

describe("scanPdf: hostile input stays bounded", () => {
  it("refuses the 60 KB quadratic file (998 /Pages and 7500 /Count%) in under 3 s", async () => {
    const dos = pdf({ extra: `/Pages ${"/Pages ".repeat(998)}${"/Count%".repeat(7500)}` });
    const start = performance.now();
    const r = await scanPdf(dos);
    expect(performance.now() - start).toBeLessThan(PDF_SCAN_TIMEOUT_MS);
    expect(r.ok).toBe(false);
  }, 10_000);

  it("refuses 8 MB of hex-escaped name bytes promptly", async () => {
    const base = Buffer.from(pdf());
    const big = Buffer.concat([
      base.subarray(0, 9),
      Buffer.from("#41".repeat(2_790_000)),
      base.subarray(9),
    ]);
    const start = performance.now();
    await scanPdf(big);
    expect(performance.now() - start).toBeLessThan(PDF_SCAN_TIMEOUT_MS + 500);
  }, 10_000);
});
