import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as TOKEN } from "@/app/api/prescriptions/blob-token/route";
import { POST as STAGE } from "@/app/api/prescriptions/staging/route";
import { getDeps, setDepsForTests } from "@/server/deps";
import { resetEnvForTests } from "@/server/env";
import { RX_STAGING_TTL_MS } from "@/server/prescriptions/prescriptions";
import { jsonPost } from "../helpers/http";
import { json, setupRxRouteHarness, stageReq } from "../helpers/rx-routes";
import { signedIn } from "../helpers/session";

const sdk = vi.hoisted(() => ({ handleUpload: vi.fn() }));
vi.mock("@vercel/blob/client", () => sdk);

setupRxRouteHarness();
beforeEach(() => {
  sdk.handleUpload.mockReset();
  // Like the SDK: ask the route for the token options, then answer with a token.
  sdk.handleUpload.mockImplementation(async ({ body, onBeforeGenerateToken }) => {
    if (body.type !== "blob.generate-client-token") return { type: body.type, response: "ok" };
    const p = body.payload;
    await onBeforeGenerateToken(p.pathname, p.clientPayload, p.multipart);
    return { type: body.type, clientToken: "client-token-test" };
  });
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-blob-token");
  resetEnvForTests();
});

const asBlob = () => setDepsForTests({ files: { ...getDeps().files, kind: "blob" } });
const tokenReq = (pathname: string, clientPayload: string | null, cookie?: string, opts = {}) =>
  jsonPost(
    "/api/prescriptions/blob-token",
    { type: "blob.generate-client-token", payload: { pathname, clientPayload, multipart: false } },
    { cookie, ...opts },
  );

describe("POST /api/prescriptions/blob-token", () => {
  it("answers 404 unless the file store is blob", async () => {
    const { cookie } = await signedIn();
    const res = await TOKEN(tokenReq("rx-staging/x/y", null, cookie));
    expect(res.status).toBe(404);
    expect(sdk.handleUpload).not.toHaveBeenCalled();
  });

  it("pins the token to the caller's staging key, types, 8 MiB, no suffix or overwrite, and the slot's expiry", async () => {
    asBlob();
    const { cookie } = await signedIn();
    const slot = await json(await STAGE(stageReq(cookie)));
    expect(slot.mode).toBe("client-token");
    const res = await TOKEN(tokenReq(slot.pathname, slot.stagingId, cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await json(res)).toEqual({
      type: "blob.generate-client-token",
      clientToken: "client-token-test",
    });
    const call = sdk.handleUpload.mock.calls[0]![0];
    expect(call.token).toBe("test-blob-token");
    const options = await call.onBeforeGenerateToken(slot.pathname, slot.stagingId, false);
    expect(options).toEqual({
      allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
      maximumSizeInBytes: 8388608,
      addRandomSuffix: false,
      allowOverwrite: false,
      validUntil: getDeps().now().getTime() + RX_STAGING_TTL_MS,
    });
    // The callback refuses any other pathname too.
    await expect(call.onBeforeGenerateToken("rx/other", slot.stagingId, false)).rejects.toThrow();
  });

  it("answers 403 for a pathname that is not the staging key, or another user's slot", async () => {
    asBlob();
    const a = await signedIn();
    const b = await signedIn();
    const slot = await json(await STAGE(stageReq(a.cookie)));
    const cases = [
      await TOKEN(tokenReq(`${slot.pathname}x`, slot.stagingId, a.cookie)),
      await TOKEN(tokenReq(`rx/${a.user._id.toHexString()}/evil.pdf`, slot.stagingId, a.cookie)),
      await TOKEN(tokenReq(slot.pathname, null, a.cookie)),
      await TOKEN(tokenReq(slot.pathname, slot.stagingId, b.cookie)),
    ];
    for (const res of cases) {
      expect(res.status).toBe(403);
      expect(await json(res)).toEqual({ error: "forbidden" });
    }
    expect(sdk.handleUpload).not.toHaveBeenCalled();
  });

  it("answers 403 without an Origin and 401 without a session", async () => {
    asBlob();
    const { cookie } = await signedIn();
    const slot = await json(await STAGE(stageReq(cookie)));
    expect(
      (await TOKEN(tokenReq(slot.pathname, slot.stagingId, cookie, { origin: null }))).status,
    ).toBe(403);
    expect((await TOKEN(tokenReq(slot.pathname, slot.stagingId))).status).toBe(401);
  });

  it("acknowledges a signed upload-completed callback and refuses one the SDK rejects", async () => {
    asBlob();
    const completed = { type: "blob.upload-completed", payload: { blob: { pathname: "p" } } };
    const ok = await TOKEN(jsonPost("/api/prescriptions/blob-token", completed, { origin: null }));
    expect(ok.status).toBe(200);
    expect(sdk.handleUpload.mock.calls[0]![0].body).toEqual(completed);
    sdk.handleUpload.mockRejectedValueOnce(new Error("Invalid callback signature"));
    const bad = await TOKEN(jsonPost("/api/prescriptions/blob-token", completed, { origin: null }));
    expect(bad.status).toBe(403);
  });
});
