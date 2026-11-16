import { describe, expect, it } from "vitest";

// Server code ships on Node/undici, so its unit tests must not run on happy-dom's
// browser globals (same-origin-enforcing fetch, its own Request/Response/URL).
describe("server unit test runtime", () => {
  it("runs in Node, not a browser emulation", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });
});
