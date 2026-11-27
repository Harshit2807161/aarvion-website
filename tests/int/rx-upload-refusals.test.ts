import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { getDeps } from "@/server/deps";
import {
  listRxForUser,
  peekStaging,
  PRESCRIPTIONS_COLLECTION,
} from "@/server/prescriptions/prescriptions";
import { htmlAsJpgName, jpegWithExif, jpegWithTrailer, pdf } from "../helpers/rx-fixtures";
import {
  AUDIT,
  finish,
  NOW,
  PATIENT,
  stage,
  trackFiles,
  uid,
  setupRxUploadHarness,
} from "../helpers/rx-upload";

setupRxUploadHarness();
afterEach(() => vi.restoreAllMocks());

const count = async (c: string) => (await getDb()).collection(c).countDocuments();

describe("finishRxUpload refusals", () => {
  it("refuses a disguised HTML file: nothing stored, the staged file deleted, the slot consumed", async () => {
    const userId = uid();
    const { finals } = trackFiles();
    const started = await stage(userId, htmlAsJpgName());
    expect(await finish(userId, started.stagingId)).toEqual({
      ok: false,
      error: "unsupported_type",
    });
    expect(await count(PRESCRIPTIONS_COLLECTION)).toBe(0);
    expect(finals()).toEqual([]);
    expect(await getDeps().files.get(started.key)).toBeNull();
    expect(await peekStaging(started.stagingId, userId, NOW)).toBeNull();
  });

  it("answers file_missing when nothing was staged, and consumes the slot", async () => {
    const userId = uid();
    const { startRxUpload } = await import("@/server/prescriptions/upload");
    const started = await startRxUpload({ userId, ipBucket: "b", now: NOW });
    if (!started.ok) throw new Error("start refused");
    expect(await finish(userId, started.stagingId)).toEqual({ ok: false, error: "file_missing" });
    expect(await peekStaging(started.stagingId, userId, NOW)).toBeNull();
  });

  it("answers too_large for a staged file over the cap, and deletes it", async () => {
    const userId = uid();
    const started = await stage(userId, new Uint8Array(8_388_609));
    expect(await finish(userId, started.stagingId)).toEqual({ ok: false, error: "too_large" });
    expect(await getDeps().files.get(started.key)).toBeNull();
  });

  it("is single use, a slot belongs to its user, and it is gone at +15 minutes exactly", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const first = await finish(userId, started.stagingId);
    expect(first.ok).toBe(true);
    // Single use: a repeat makes nothing new and answers with the slot's record (R6-I1).
    const again = await finish(userId, started.stagingId);
    expect(again).toMatchObject({ ok: true, replay: true });
    expect(again.ok && first.ok && again.rx.id).toBe(first.ok && first.rx.id);

    const mine = await stage(userId, await jpegWithExif());
    expect(await finish(uid(), mine.stagingId)).toEqual({ ok: false, error: "upload_expired" });

    const late = await stage(userId, await jpegWithExif());
    const at = new Date(NOW.getTime() + 15 * 60_000);
    expect(await finish(userId, late.stagingId, at)).toEqual({
      ok: false,
      error: "upload_expired",
    });
  });

  it("re-parses its input: an operator object or a bad name never reaches Mongo", async () => {
    const userId = uid();
    const { finishRxUpload } = await import("@/server/prescriptions/upload");
    for (const bad of [
      { stagingId: { $ne: null }, patientName: PATIENT, declaration: true },
      { stagingId: "A".repeat(22), patientName: "A", declaration: true },
    ]) {
      await expect(
        finishRxUpload({ userId, role: "customer", body: bad as never, now: NOW }),
      ).rejects.toThrow();
    }
  });
});

describe("finishRxUpload stored files", () => {
  it("drops bytes appended after the image", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithTrailer("<script>alert(1)</script>"));
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
    const doc = (await listRxForUser(userId))[0]!;
    const stored = await getDeps().files.get(doc.file.key);
    expect(Buffer.from(stored!.body).toString("latin1")).not.toContain("<script>");
  });

  it("stores a PDF unchanged, with its page count and a pdf record", async () => {
    const userId = uid();
    const bytes = pdf({ pages: 3 });
    const started = await stage(userId, bytes);
    const r = await finish(userId, started.stagingId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rx).toMatchObject({ kind: "pdf", pages: 3, status: "under_review" });
    const doc = (await listRxForUser(userId))[0]!;
    expect(doc.file).toMatchObject({ contentType: "application/pdf", kind: "pdf", pages: 3 });
    expect(doc.file.key).toMatch(/^rx\/[0-9a-f]{24}\/[0-9a-f]{24}\.pdf$/);
    const stored = await getDeps().files.get(doc.file.key);
    expect(Buffer.from(stored!.body).equals(Buffer.from(bytes))).toBe(true);
  });

  it("records the caller's role in the audit row, with ids and flags only", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const r = await finish(userId, started.stagingId, NOW, "pharmacist");
    expect(r.ok).toBe(true);
    const audit = await (await getDb()).collection(AUDIT).find({ action: "rx.upload" }).toArray();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actor: { type: "user", userId, role: "pharmacist" },
      meta: { kind: "image", pages: 1 },
    });
    expect(JSON.stringify(audit[0])).not.toContain(PATIENT);
  });
});
