// Runs in a worker thread (see pdf-scan.ts): parses a PDF with pdf-lib and walks every object.
// Plain ESM so node can load it without a build step. Sends back a result and nothing else.
import { parentPort, workerData } from "node:worker_threads";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFParser, PDFRawStream, PDFRef } from "pdf-lib";

const MAX_PAGES = 20;
/** Dictionary keys that make a PDF refused (OpenAction is allowed only as a destination array). */
const REFUSED_KEYS = new Set([
  "JS",
  "JavaScript",
  "AA",
  "Launch",
  "GoToR",
  "GoToE",
  "SubmitForm",
  "ImportData",
  "RichMedia",
  "EmbeddedFile",
  "EmbeddedFiles",
  "XFA",
  "Thread",
  "Sound",
  "Movie",
  "Rendition",
]);
/** An action dictionary's /S: every action type is refused, /URI and /GoTo included. */
const ACTION_TYPES = new Set([
  "GoTo",
  "GoToR",
  "GoToE",
  "GoTo3DView",
  "Launch",
  "Thread",
  "URI",
  "Sound",
  "Movie",
  "Hide",
  "Named",
  "SubmitForm",
  "ResetForm",
  "ImportData",
  "JavaScript",
  "SetOCGState",
  "Rendition",
  "RichMediaExecute",
]);
const name = (n) => n.asString().slice(1);

/**
 * The refusal for the first problem under the objects in `stack`, else null. A reference to an
 * object pdf-lib never parsed is refused: a viewer would find it through the xref (or by
 * repairing the file) and pdf-lib did not look at it.
 */
function refusal(context, stack) {
  let seen = 0;
  while (stack.length > 0) {
    const o = stack.pop();
    if (++seen > 5_000_000) return "corrupt"; // fail closed on an absurd object graph
    if (o instanceof PDFRef) {
      if (context.lookup(o) === undefined) return "corrupt";
      continue;
    }
    const dict = o instanceof PDFRawStream ? o.dict : o;
    if (dict instanceof PDFDict) {
      for (const [k, v] of dict.entries()) {
        const key = name(k);
        if (key === "Encrypt") return "encrypted";
        if (REFUSED_KEYS.has(key)) return "active_content";
        // /OpenAction is a destination (an array, direct or by reference) or an action: refuse the latter.
        if (key === "OpenAction" && !(context.lookup(v) instanceof PDFArray))
          return "active_content";
        if (key === "S" && v instanceof PDFName && ACTION_TYPES.has(name(v)))
          return "active_content";
        stack.push(v);
      }
    } else if (o instanceof PDFArray) {
      for (const v of o.asArray()) stack.push(v);
    }
  }
  return null;
}

async function check(bytes) {
  let context;
  let doc;
  // Every definition of every object is kept, because pdf-lib keeps only the last of a duplicate
  // and a viewer may read an earlier one (an incremental update is legitimate, a trick is not).
  const versions = [];
  try {
    // Strict: a bad object throws, and an encrypted file throws an "is encrypted" error.
    const parser = PDFParser.forBytesWithOptions(bytes, Infinity, true, false);
    const assign = parser.context.assign.bind(parser.context);
    parser.context.assign = (ref, obj) => {
      versions.push(obj);
      assign(ref, obj);
    };
    context = await parser.parseDocument();
    doc = new PDFDocument(context, false, false);
  } catch (e) {
    return { ok: false, error: /is encrypted/.test(String(e?.message)) ? "encrypted" : "corrupt" };
  }
  if (doc.isEncrypted) return { ok: false, error: "encrypted" };
  // enumerateIndirectObjects() includes the members of object streams, which pdf-lib has loaded.
  const all = context.enumerateIndirectObjects().map(([, o]) => o);
  const why = refusal(context, [...versions, ...all, ...Object.values(context.trailerInfo)]);
  if (why) return { ok: false, error: why };
  const pages = doc.getPageCount();
  if (pages < 1) return { ok: false, error: "corrupt" };
  if (pages > MAX_PAGES) return { ok: false, error: "too_many_pages" };
  return { ok: true, pages };
}

try {
  parentPort.postMessage(await check(workerData));
} catch {
  parentPort.postMessage({ ok: false, error: "corrupt" });
}
