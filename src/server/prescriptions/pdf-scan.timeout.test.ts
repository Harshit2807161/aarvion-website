import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pdf } from "../../../tests/helpers/rx-fixtures";

/** A worker that never answers, as a hostile file that hangs the parse would be. */
const terminate = vi.hoisted(() => vi.fn());
vi.mock("node:worker_threads", () => ({
  Worker: class extends EventEmitter {
    terminate = terminate;
  },
}));

import { PDF_SCAN_TIMEOUT_MS, scanPdf } from "./pdf-scan";

afterEach(() => {
  vi.useRealTimers();
  terminate.mockClear();
});

describe("scanPdf timeout", () => {
  it("refuses and terminates the worker when the parse does not finish in time", async () => {
    vi.useFakeTimers();
    const result = scanPdf(pdf());
    await vi.advanceTimersByTimeAsync(PDF_SCAN_TIMEOUT_MS + 1);
    expect(await result).toEqual({ ok: false, error: "corrupt" });
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
