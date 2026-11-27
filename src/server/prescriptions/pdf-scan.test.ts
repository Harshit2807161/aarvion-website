import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { objStmPdf, pdf } from "../../../tests/helpers/rx-fixtures";
import { PDF_INFLATE_BUDGET, scanPdf } from "./pdf-scan";

const err = (error: string) => ({ ok: false, error });
const catalog = (extra: string) => scanPdf(pdf({ extra }));

describe("scanPdf: names, and what ends one", () => {
  it.each([
    [
      "a hex-escaped /JS in /OpenAction",
      "/OpenAction << /S /J#53 (app.alert(1)) >>",
      "active_content",
    ],
    ["/JavaScript", "/AA << /O << /S /JavaScript /JS (x) >> >>", "active_content"],
    ["/Launch", "/OpenAction << /S /Launch >>", "active_content"],
    ["/EmbeddedFile", "/Names << /EmbeddedFile 9 0 R >>", "active_content"],
    ["/EmbeddedFiles", "/Names << /EmbeddedFiles 9 0 R >>", "active_content"],
    ["/RichMedia", "/Annots [<< /Subtype /RichMedia >>]", "active_content"],
    ["/XFA", "/AcroForm << /XFA [] >>", "active_content"],
    ["/SubmitForm", "/A << /S /SubmitForm /F (x) >>", "active_content"],
    ["/ImportData", "/A << /S /ImportData >>", "active_content"],
    ["/GoToR (can leak a hash)", "/OpenAction << /S /GoToR /F (x) >>", "active_content"],
    ["/GoToE", "/OpenAction << /S /GoToE >>", "active_content"],
    ["/Encrypt", "/Encrypt 5 0 R", "encrypted"],
    ["a hex-escaped /Encrypt", "/Encr#79pt 5 0 R", "encrypted"],
    // one byte after the name that is not whitespace, `/`, `[`, `<`, `(` or `>`
    ["/JavaScript then a comment", "/S /JavaScript%x\n/JS%x\n(app.alert(1))", "active_content"],
    ["/JavaScript then NUL", "/S /JavaScript\0/JS\0(app.alert(1))", "active_content"],
    ["/JS in an array", "/AA [/JS]", "active_content"],
    ["/JS then )", "/AA (/JS) /X (/JS)", "active_content"],
    ["/Launch then a comment", "/S/Launch%\n/F (calc.exe)", "active_content"],
    ["/Launch then }", "/S /Launch}", "active_content"],
    ["/Encrypt then a comment", "/Encrypt%\n5 0 R", "encrypted"],
    ["/Encrypt then NUL", "/Encrypt\x005 0 R", "encrypted"],
  ])("refuses %s", (_n, extra, error) => {
    expect(catalog(extra)).toEqual(err(error));
  });

  it.each([
    [
      "longer names that only start with a blocked one",
      "/JSONData 1 0 R /Launchpad 2 0 R /Encrypted 3 0 R",
    ],
    ["/URI (a link is allowed)", "/OpenAction << /S /URI /URI (https://example.com) >>"],
  ])("accepts %s", (_n, extra) => {
    expect(catalog(extra)).toEqual({ ok: true, pages: 1 });
  });
});

describe("scanPdf: pages and the end of the file", () => {
  it("counts pages, refuses 21 and accepts 20", () => {
    expect(scanPdf(pdf({ pages: 2 }))).toEqual({ ok: true, pages: 2 });
    expect(scanPdf(pdf({ pages: 20 }))).toEqual({ ok: true, pages: 20 });
    expect(scanPdf(pdf({ pages: 21 }))).toEqual(err("too_many_pages"));
  });

  it("does not let a comment or NUL between /Type and /Page hide a page", () => {
    const raw = Buffer.from(pdf({ pages: 21 })).toString("latin1");
    const hidden = (gap: string) =>
      Buffer.from(raw.replace(/\/Type \/Page /g, `/Type${gap}/Page `), "latin1");
    expect(scanPdf(hidden("%c\n"))).toEqual(err("too_many_pages"));
    expect(scanPdf(hidden("\0"))).toEqual(err("too_many_pages"));
  });

  it("takes the larger of the leaf count and the /Count of the page tree", () => {
    const lying = Buffer.from(pdf({ pages: 2 }))
      .toString("latin1")
      .replace("/Count 2", "/Count 30");
    expect(scanPdf(Buffer.from(lying, "latin1"))).toEqual(err("too_many_pages"));
  });

  it("refuses a missing or distant %%EOF, and no pages", () => {
    const noEof = Buffer.from(pdf()).toString("latin1").replace("%%EOF", "");
    expect(scanPdf(Buffer.from(noEof, "latin1"))).toEqual(err("corrupt"));
    expect(scanPdf(Buffer.concat([pdf(), Buffer.alloc(2000, 0x20)]))).toEqual(err("corrupt"));
    expect(scanPdf(pdf({ pages: 0 }))).toEqual(err("corrupt"));
  });
});

describe("scanPdf: compressed object streams", () => {
  it("counts the pages of a legitimate PDF whose page tree is in an object stream", () => {
    expect(scanPdf(objStmPdf({ leaves: 3 }))).toEqual({ ok: true, pages: 3 });
  });

  it("refuses a decoy page outside the stream when the real count inside is over 20", () => {
    expect(scanPdf(objStmPdf({ leaves: 25, decoys: 1 }))).toEqual(err("too_many_pages"));
    expect(scanPdf(objStmPdf({ leaves: 2, count: 30, decoys: 1 }))).toEqual(err("too_many_pages"));
  });

  it("reports the real page count, not the decoy", () => {
    expect(scanPdf(objStmPdf({ leaves: 4, decoys: 1 }))).toEqual({ ok: true, pages: 5 });
  });

  it("rescans the inflated text for active content", () => {
    expect(scanPdf(objStmPdf({ inner: "<< /S /JavaScript /JS (x) >>" }))).toEqual(
      err("active_content"),
    );
    expect(scanPdf(objStmPdf({ inner: "<< /S /J#53 >>" }))).toEqual(err("active_content"));
  });

  it("refuses any other filter on an object stream, and bad or oversized data", () => {
    expect(scanPdf(objStmPdf({ filter: "/ASCIIHexDecode" }))).toEqual(err("corrupt"));
    expect(scanPdf(objStmPdf({ data: Buffer.from("not zlib data") }))).toEqual(err("corrupt"));
    const bomb = deflateSync(Buffer.alloc(PDF_INFLATE_BUDGET + 1));
    expect(scanPdf(objStmPdf({ data: bomb }))).toEqual(err("corrupt"));
  });
});

describe("scanPdf: hostile input stays bounded", () => {
  const wrap = (filler: string) => {
    const base = Buffer.from(pdf());
    return Buffer.concat([base.subarray(0, 9), Buffer.from(filler), base.subarray(9)]);
  };

  it("refuses more than 10,000 streams, and more than 1000 page-tree names", () => {
    expect(scanPdf(wrap("stream\n".repeat(10_001)))).toEqual(err("corrupt"));
    expect(scanPdf(wrap("/Pages ".repeat(1001)))).toEqual(err("too_many_pages"));
  });

  it("reads an object stream that has no /Type but has /N and /First", () => {
    const raw = Buffer.from(objStmPdf({ inner: "<< /S /JavaScript >>" })).toString("latin1");
    const untyped = Buffer.from(raw.replace("/Type /ObjStm", ""), "latin1");
    expect(scanPdf(untyped)).toEqual(err("active_content"));
  });
});
