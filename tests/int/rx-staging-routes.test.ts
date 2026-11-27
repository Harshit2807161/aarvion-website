import { describe, expect, it } from "vitest";
import { PUT } from "@/app/api/prescriptions/staging/[id]/route";
import { POST as STAGE } from "@/app/api/prescriptions/staging/route";
import { getDeps, setDepsForTests } from "@/server/deps";
import { RX_MAX_BYTES } from "@/server/prescriptions/file-check";
import { installClock } from "../helpers/clock";
import { jsonPost } from "../helpers/http";
import {
  ctx,
  json,
  putReq,
  setupRxRouteHarness,
  stagedViaRoutes,
  stageReq,
} from "../helpers/rx-routes";
import { signedIn } from "../helpers/session";

setupRxRouteHarness();

describe("POST /api/prescriptions/staging", () => {
  it("issues a direct-mode slot under the caller's staging prefix", async () => {
    const { user, cookie } = await signedIn();
    const res = await STAGE(stageReq(cookie));
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const slot = await json(res);
    expect(slot).toEqual({
      stagingId: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
      mode: "direct",
      pathname: `rx-staging/${user._id.toHexString()}/${slot.stagingId}`,
    });
  });

  it("answers 401 without a session, and 403 without an Origin", async () => {
    expect((await STAGE(stageReq())).status).toBe(401);
    const id = "a".repeat(22);
    expect((await PUT(putReq(id, new Uint8Array(1)), ctx(id))).status).toBe(401);
    const { cookie } = await signedIn();
    const noOrigin = await STAGE(
      jsonPost("/api/prescriptions/staging", undefined, { cookie, origin: null }),
    );
    expect(noOrigin.status).toBe(403);
  });

  it("rate limits with 429 and Retry-After after 10 slots an hour", async () => {
    const { cookie } = await signedIn();
    for (let i = 0; i < 10; i++) expect((await STAGE(stageReq(cookie))).status).toBe(201);
    const res = await STAGE(stageReq(cookie));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("PUT /api/prescriptions/staging/[id]", () => {
  it("stores the bytes at the slot's key", async () => {
    const { cookie } = await signedIn();
    const slot = await stagedViaRoutes(cookie, new Uint8Array([1, 2, 3]));
    expect((await getDeps().files.get(slot.pathname))?.body).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("refuses RX_MAX_BYTES + 1 with 413 file_too_large and an empty body with 400", async () => {
    const { cookie } = await signedIn();
    const { stagingId } = await json(await STAGE(stageReq(cookie)));
    const big = await PUT(
      putReq(stagingId, new Uint8Array(RX_MAX_BYTES + 1), { cookie }),
      ctx(stagingId),
    );
    expect(big.status).toBe(413);
    expect(await json(big)).toEqual({ error: "file_too_large" });
    const empty = await PUT(putReq(stagingId, new Uint8Array(0), { cookie }), ctx(stagingId));
    expect(empty.status).toBe(400);
    expect(await json(empty)).toEqual({ error: "invalid_file" });
  });

  it("refuses a PUT without Origin with 403", async () => {
    const { cookie } = await signedIn();
    const { stagingId } = await json(await STAGE(stageReq(cookie)));
    const res = await PUT(
      putReq(stagingId, new Uint8Array(1), { cookie, origin: null }),
      ctx(stagingId),
    );
    expect(res.status).toBe(403);
  });

  it("answers 404 for another user's slot, a malformed id, under blob and once expired", async () => {
    const a = await signedIn();
    const b = await signedIn();
    const { stagingId } = await json(await STAGE(stageReq(a.cookie)));
    const put = (cookie: string, id = stagingId) =>
      PUT(putReq(id, new Uint8Array([1]), { cookie }), ctx(id));
    const other = await put(b.cookie);
    expect(other.status).toBe(404);
    expect(await json(other)).toEqual({ error: "not_found" });
    expect((await put(a.cookie, "x")).status).toBe(404);

    const files = getDeps().files;
    setDepsForTests({ files: { ...files, kind: "blob" } });
    expect((await put(a.cookie)).status).toBe(404);
    setDepsForTests({ files });

    installClock("2026-11-27T10:15:00Z"); // the slot's expiresAt: no longer live
    expect((await put(a.cookie)).status).toBe(404);
  });

  it("accepts a retried PUT of the same bytes and refuses different bytes with 409", async () => {
    const { cookie } = await signedIn();
    const { stagingId } = await stagedViaRoutes(cookie, new Uint8Array([1, 2, 3]));
    const same = await PUT(
      putReq(stagingId, new Uint8Array([1, 2, 3]), { cookie }),
      ctx(stagingId),
    );
    expect(same.status).toBe(204);
    const other = await PUT(putReq(stagingId, new Uint8Array([9]), { cookie }), ctx(stagingId));
    expect(other.status).toBe(409);
    expect(await json(other)).toEqual({ error: "already_uploaded" });
  });
});
