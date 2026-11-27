import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";

export type PdfScan =
  | { ok: true; pages: number }
  | {
      ok: false;
      error: "corrupt" | "too_many_pages" | "encrypted" | "active_content" | "busy";
    };

/** The most pages a prescription PDF may have (the worker enforces it; keep the two in step). */
export const PDF_MAX_PAGES = 20;
/** A parse that takes longer than this is killed and the file refused (real files take ~90 ms). */
export const PDF_SCAN_TIMEOUT_MS = 1000;
/** Scans waiting behind the running one; a further request is refused as `busy` (retryable). */
export const PDF_MAX_WAITING = 4;

const WORKER = fileURLToPath(new URL("./pdf-worker.mjs", import.meta.url));

// One scan per process at a time: pdf-lib inflates object streams off-heap, so a hostile file can
// take hundreds of MB before the timeout fires, and parallel scans would add up.
let running = false;
const waiting: (() => void)[] = [];
const release = () => {
  const next = waiting.shift();
  if (next) next();
  else running = false;
};

function runWorker(bytes: Uint8Array): Promise<PdfScan> {
  return new Promise((resolve) => {
    // The worker gets its own copy: a transferred buffer would detach the caller's bytes.
    const worker = new Worker(WORKER, { workerData: new Uint8Array(bytes) });
    let settled = false;
    const finish = (r: PdfScan) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, error: "corrupt" }), PDF_SCAN_TIMEOUT_MS);
    worker.once("message", (m: PdfScan) => finish(m));
    worker.once("error", () => finish({ ok: false, error: "corrupt" }));
    worker.once("exit", () => finish({ ok: false, error: "corrupt" }));
  });
}

/**
 * Validate a PDF by parsing it, not by pattern-matching its text. pdf-lib reads the file with
 * strict options in a worker thread (a hostile file cannot hold the server past
 * PDF_SCAN_TIMEOUT_MS), and the worker walks every definition of every indirect object,
 * object-stream members and duplicates included, refusing any dictionary key or action that can
 * run code, open a file or leak a path, and any reference to an object it never parsed.
 * Encryption, any parse error, a timeout, 0 pages and more than PDF_MAX_PAGES pages are refused.
 * The bytes are only read, never rewritten: the caller stores the original, so a digital
 * signature stays valid. Fail closed: only a clean result from the worker is `ok`.
 *
 * RESIDUAL RISK (ruling in docs/decisions/rulings.md): pdf-lib reads the file linearly and a
 * viewer follows the cross-reference table, so a crafted file can still show a viewer something
 * this parse did not (for example a second trailer naming another `/Root`). The check is one layer.
 * The Phase D admin viewer MUST show prescriptions with pdf.js, scripting off, in a sandboxed
 * iframe (and never hand the file to a native PDF plugin). PDF metadata is kept (phase H).
 */
export async function scanPdf(bytes: Uint8Array): Promise<PdfScan> {
  // A cheap prefilter that can only refuse: a PDF ends with %%EOF within its last 1024 bytes.
  const tail = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).subarray(-1024);
  if (!tail.includes("%%EOF")) return { ok: false, error: "corrupt" };
  if (running) {
    if (waiting.length >= PDF_MAX_WAITING) return { ok: false, error: "busy" };
    await new Promise<void>((resolve) => waiting.push(resolve)); // the slot is handed over
  } else running = true;
  try {
    return await runWorker(bytes);
  } finally {
    release();
  }
}
