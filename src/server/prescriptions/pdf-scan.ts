import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";

export type PdfScan =
  | { ok: true; pages: number }
  | { ok: false; error: "corrupt" | "too_many_pages" | "encrypted" | "active_content" };

/** The most pages a prescription PDF may have (the worker enforces it; keep the two in step). */
export const PDF_MAX_PAGES = 20;
/** A parse that takes longer than this is killed and the file refused. */
export const PDF_SCAN_TIMEOUT_MS = 3000;

const WORKER = fileURLToPath(new URL("./pdf-worker.mjs", import.meta.url));

/**
 * Validate a PDF by parsing it, not by pattern-matching its text. pdf-lib reads the file with
 * strict options in a worker thread (so a hostile file cannot hold the server past
 * PDF_SCAN_TIMEOUT_MS), and the worker walks every indirect object, object-stream members
 * included, refusing any dictionary key or action that can run code, open a file or leak a path.
 * Encryption, any parse error, a timeout, 0 pages and more than PDF_MAX_PAGES pages are refused.
 * The bytes are only read, never rewritten: the caller stores the original. Fail closed: only
 * a clean result from the worker is `ok`. Left for phase H: PDF metadata is kept.
 */
export function scanPdf(bytes: Uint8Array): Promise<PdfScan> {
  // A cheap prefilter that can only refuse: a PDF ends with %%EOF within its last 1024 bytes.
  const tail = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).subarray(-1024);
  if (!tail.includes("%%EOF")) return Promise.resolve({ ok: false, error: "corrupt" });
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
