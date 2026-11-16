import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../http";
import { resetEnvForTests } from "../env";
import { assertSameOrigin } from "./origin";
import { jsonPost, getReq } from "../../../tests/helpers/http";

function status(fn: () => void): { status: number; code: string } | null {
  try {
    fn();
    return null;
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, code: e.code };
    throw e;
  }
}

describe("assertSameOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvForTests();
  });

  it("passes a POST whose Origin matches the request origin", () => {
    expect(() => assertSameOrigin(jsonPost("/api/x", {}))).not.toThrow();
  });

  it.each([
    ["a foreign Origin", "https://evil.example"],
    ["a missing Origin", null],
    ["Origin: null", "null"],
  ])("rejects %s with 403 bad_origin", (_n, origin) => {
    const req = jsonPost("/api/x", {}, { origin });
    expect(status(() => assertSameOrigin(req))).toEqual({ status: 403, code: "bad_origin" });
  });

  it("does not require Origin on GET", () => {
    expect(() => assertSameOrigin(getReq("/api/x"))).not.toThrow();
  });

  it("rejects other unsafe methods without Origin", () => {
    const req = new Request("http://localhost:3000/api/x", { method: "DELETE" });
    expect(status(() => assertSameOrigin(req))).toEqual({ status: 403, code: "bad_origin" });
  });

  it("accepts the APP_URL origin behind an internal host", () => {
    vi.stubEnv("APP_URL", "https://aarvion.example");
    resetEnvForTests();
    const req = new Request("http://internal:3000/api/x", {
      method: "POST",
      headers: { origin: "https://aarvion.example" },
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });
});
