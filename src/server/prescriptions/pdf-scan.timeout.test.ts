import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pdf } from "../../../tests/helpers/rx-fixtures";

/** A worker that never answers, as a hostile file that hangs the parse would be. */
const created = vi.hoisted(() => ({ terminate: vi.fn(), count: 0 }));
vi.mock("node:worker_threads", () => ({
  Worker: class extends EventEmitter {
    terminate = created.terminate;
    constructor() {
      super();
      created.count++;
    }
  },
}));

import { PDF_MAX_WAITING, PDF_SCAN_TIMEOUT_MS, scanPdf } from "./pdf-scan";

afterEach(() => {
  vi.useRealTimers();
  created.terminate.mockClear();
  created.count = 0;
});

describe("scanPdf timeout and queue", () => {
  it("allows a scan one second and terminates its worker after that", async () => {
    expect(PDF_SCAN_TIMEOUT_MS).toBe(1000);
    vi.useFakeTimers();
    const result = scanPdf(pdf());
    await vi.advanceTimersByTimeAsync(PDF_SCAN_TIMEOUT_MS + 1);
    expect(await result).toEqual({ ok: false, error: "corrupt" });
    expect(created.terminate).toHaveBeenCalledTimes(1);
  });

  it("runs one scan at a time, queues four, and refuses the next as busy", async () => {
    vi.useFakeTimers();
    const all = Array.from({ length: 1 + PDF_MAX_WAITING + 1 }, () => scanPdf(pdf()));
    await vi.advanceTimersByTimeAsync(0);
    expect(created.count).toBe(1); // only the first has a worker
    expect(await all[5]).toEqual({ ok: false, error: "busy" });
    for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(PDF_SCAN_TIMEOUT_MS + 1);
    expect(created.count).toBe(5); // each waiting scan ran, one after another
    expect((await Promise.all(all.slice(0, 5))).every((r) => !r.ok)).toBe(true);
  });
});
