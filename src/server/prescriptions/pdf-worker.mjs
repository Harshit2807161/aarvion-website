// Runs in a worker thread (see pdf-scan.ts): parses a PDF with pdf-lib and walks every object.
// Plain ESM so node can load it without a build step. Sends back a result and nothing else.
import { parentPort, workerData } from "node:worker_threads";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

const MAX_PAGES = 20;
/** Names that make a PDF refused, as a dictionary key or as an action's /S. */
const REFUSED = new Set([
  "JS",
  "JavaScript",
  "OpenAction",
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
const name = (n) => n.asString().slice(1);

/** The refusal for the first dictionary under `root` with a refused key or action, else null. */
function refusal(root) {
  const stack = [root];
  let seen = 0;
  while (stack.length > 0) {
    const o = stack.pop();
    if (++seen > 5_000_000) return "corrupt"; // fail closed on an absurd object graph
    const dict = o instanceof PDFRawStream ? o.dict : o;
    if (dict instanceof PDFDict) {
      for (const [k, v] of dict.entries()) {
        if (name(k) === "Encrypt") return "encrypted";
        if (REFUSED.has(name(k))) return "active_content";
        if (name(k) === "S" && v instanceof PDFName && REFUSED.has(name(v)))
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
  let doc;
  try {
    // Strict: a bad object throws, and an encrypted file throws an "is encrypted" error.
    doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  } catch (e) {
    return {
      ok: false,
      error: /is encrypted/.test(String(e?.message)) ? "encrypted" : "corrupt",
    };
  }
  if (doc.isEncrypted) return { ok: false, error: "encrypted" };
  // enumerateIndirectObjects() includes the members of object streams, which pdf-lib has loaded.
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const why = refusal(obj);
    if (why) return { ok: false, error: why };
  }
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
