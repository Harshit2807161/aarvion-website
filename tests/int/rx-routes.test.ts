import { MongoServerError } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { GET as LIST, POST as FINALISE } from "@/app/api/prescriptions/route";
import { POST as STAGE } from "@/app/api/prescriptions/staging/route";
import { finishRxUpload } from "@/server/prescriptions/upload";
import { installClock } from "../helpers/clock";
import { getReq, jsonPost } from "../helpers/http";
import { jpegWithExif, pdf } from "../helpers/rx-fixtures";
import { PATIENT } from "../helpers/rx-upload";
import { json, setupRxRouteHarness, stagedViaRoutes, stageReq } from "../helpers/rx-routes";
import { signedIn } from "../helpers/session";

vi.mock("@/server/prescriptions/upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/prescriptions/upload")>();
  return { ...actual, finishRxUpload: vi.fn(actual.finishRxUpload) };
});

setupRxRouteHarness();

const finaliseBody = (stagingId: string, patientName = PATIENT) => ({
  stagingId,
  patientName,
  declaration: true,
});

const finalise = (body: unknown, opts: { cookie?: string; origin?: string | null } = {}) =>
  FINALISE(jsonPost("/api/prescriptions", body, opts));

describe("the upload flow through the routes", () => {
  it("stages, puts, finalises and lists an image", async () => {
    const { cookie } = await signedIn();
    const slot = await stagedViaRoutes(cookie, await jpegWithExif());
    const done = await finalise(finaliseBody(slot.stagingId), { cookie });
    expect(done.status).toBe(201);
    expect(done.headers.get("cache-control")).toBe("no-store");
    const { rx } = await json(done);
    expect(rx).toMatchObject({
      kind: "image",
      pages: 1,
      status: "under_review",
      patientName: PATIENT,
    });

    const list = await LIST(getReq("/api/prescriptions", { cookie }));
    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect((await json(list)).items).toEqual([rx]);
  });

  it("answers a repeat finalise of a used slot with 200 and the same record; another user gets 410", async () => {
    const { cookie } = await signedIn();
    const slot = await stagedViaRoutes(cookie, await jpegWithExif());
    const first = await finalise(finaliseBody(slot.stagingId), { cookie });
    expect(first.status).toBe(201);
    const { rx } = await json(first);
    const again = await finalise(finaliseBody(slot.stagingId), { cookie });
    expect(again.status).toBe(200);
    expect(again.headers.get("cache-control")).toBe("no-store");
    expect(await json(again)).toEqual({ rx });
    const other = await signedIn();
    const theirs = await finalise(finaliseBody(slot.stagingId), { cookie: other.cookie });
    expect(theirs.status).toBe(410);
    expect(await json(theirs)).toEqual({ error: "upload_expired" });
  });

  it("finalises a one-page PDF", async () => {
    const { cookie } = await signedIn();
    const slot = await stagedViaRoutes(cookie, pdf());
    const done = await finalise(finaliseBody(slot.stagingId), { cookie });
    expect(done.status).toBe(201);
    expect((await json(done)).rx).toMatchObject({ kind: "pdf", pages: 1 });
  });

  it("answers 401 without a session, and lists only the caller's own records", async () => {
    expect((await LIST(getReq("/api/prescriptions"))).status).toBe(401);
    expect((await finalise(finaliseBody("a".repeat(22)))).status).toBe(401);
    const a = await signedIn();
    const b = await signedIn();
    const slot = await stagedViaRoutes(a.cookie, await jpegWithExif());
    expect((await finalise(finaliseBody(slot.stagingId), { cookie: a.cookie })).status).toBe(201);
    expect(
      (await json(await LIST(getReq("/api/prescriptions", { cookie: b.cookie })))).items,
    ).toEqual([]);
  });
});

describe("POST /api/prescriptions (finalise)", () => {
  it("answers 400 invalid_request for declaration false and a zero-width patient name", async () => {
    const { cookie } = await signedIn();
    const slot = await stagedViaRoutes(cookie, await jpegWithExif());
    const noDecl = await finalise(
      { ...finaliseBody(slot.stagingId), declaration: false },
      { cookie },
    );
    expect(noDecl.status).toBe(400);
    expect(await json(noDecl)).toEqual({ error: "invalid_request" });
    expect((await finalise(finaliseBody(slot.stagingId, "A\u200b"), { cookie })).status).toBe(400);
    // Neither attempt used the slot.
    expect((await finalise(finaliseBody(slot.stagingId), { cookie })).status).toBe(201);
  });

  it("answers 403 without Origin, 422 with the file error, then 410 for the used slot", async () => {
    const { cookie } = await signedIn();
    const slot = await stagedViaRoutes(cookie, new TextEncoder().encode("<!doctype html>"));
    const body = finaliseBody(slot.stagingId);
    expect((await finalise(body, { cookie, origin: null })).status).toBe(403);
    const bad = await finalise(body, { cookie });
    expect(bad.status).toBe(422);
    expect(await json(bad)).toEqual({ error: "invalid_file", reason: "unsupported_type" });
    const again = await finalise(body, { cookie });
    expect(again.status).toBe(410);
    expect(await json(again)).toEqual({ error: "upload_expired" });
  });

  it("answers 422 file_missing when nothing was put", async () => {
    const { cookie } = await signedIn();
    const { stagingId } = await json(await STAGE(stageReq(cookie)));
    const res = await finalise(finaliseBody(stagingId), { cookie });
    expect(res.status).toBe(422);
    expect(await json(res)).toEqual({ error: "invalid_file", reason: "file_missing" });
  });

  it("maps busy to a retryable 503 with Retry-After, never a 4xx", async () => {
    const { cookie } = await signedIn();
    vi.mocked(finishRxUpload).mockResolvedValueOnce({ ok: false, error: "busy" });
    const res = await finalise(finaliseBody("a".repeat(22)), { cookie });
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("5");
    expect(await json(res)).toEqual({ error: "busy", retryAfterSec: 5 });
  });

  it("maps an unknown commit result to a retryable 500, and other errors to internal_error", async () => {
    const { cookie } = await signedIn();
    const unknown = new MongoServerError({ message: "no majority in time", code: 1 });
    unknown.addErrorLabel("UnknownTransactionCommitResult");
    vi.mocked(finishRxUpload).mockRejectedValueOnce(unknown);
    const post = () => finalise(finaliseBody("a".repeat(22)), { cookie });
    const res = await post();
    expect(res.status).toBe(500);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(await json(res)).toEqual({
      error: "upload_unconfirmed",
      retryable: true,
      retryAfterSec: 30,
    });

    vi.mocked(finishRxUpload).mockRejectedValueOnce(new Error("boom"));
    const other = await post();
    expect(other.status).toBe(500);
    expect(await json(other)).toEqual({ error: "internal_error" });
  });

  it("passes a fresh clock reading per request, never a cached one", async () => {
    const { cookie } = await signedIn();
    const clock = installClock("2026-11-27T10:00:00Z");
    const seen: number[] = [];
    const record = async (i: { now: Date }) => {
      seen.push(i.now.getTime());
      return { ok: false as const, error: "upload_expired" as const };
    };
    vi.mocked(finishRxUpload).mockImplementationOnce(record).mockImplementationOnce(record);
    const post = () => finalise(finaliseBody("a".repeat(22)), { cookie });
    await post();
    clock.advance(31_000);
    await post();
    expect(seen[1]! - seen[0]!).toBe(31_000);
  });
});
