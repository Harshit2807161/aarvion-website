import { Collection } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { GET as FILE } from "@/app/api/prescriptions/[id]/file/route";
import { POST as FINALISE } from "@/app/api/prescriptions/route";
import { USERS_COLLECTION } from "@/server/auth/users";
import { getDb } from "@/server/db/client";
import { getDeps, setDepsForTests } from "@/server/deps";
import { PRESCRIPTIONS_COLLECTION } from "@/server/prescriptions/prescriptions";
import { hitRateLimit } from "@/server/security/rate-limit";
import { getReq, jsonPost } from "../helpers/http";
import { jpegWithExif, pdf } from "../helpers/rx-fixtures";
import { ctx, json, setupRxRouteHarness, stagedViaRoutes } from "../helpers/rx-routes";
import { AUDIT, PATIENT } from "../helpers/rx-upload";
import { signedIn } from "../helpers/session";

setupRxRouteHarness();

/** A finalised prescription owned by a new user: its id, the owner's cookie and user. */
async function uploaded(bytes?: Uint8Array) {
  const owner = await signedIn();
  const slot = await stagedViaRoutes(owner.cookie, bytes ?? (await jpegWithExif()));
  const res = await FINALISE(
    jsonPost(
      "/api/prescriptions",
      { stagingId: slot.stagingId, patientName: PATIENT, declaration: true },
      { cookie: owner.cookie },
    ),
  );
  expect(res.status).toBe(201);
  return { id: (await json(res)).rx.id as string, ...owner };
}
const fileOf = (id: string, cookie?: string) =>
  FILE(getReq(`/api/prescriptions/${id}/file`, { cookie }), ctx(id));
const views = async () => (await getDb()).collection(AUDIT).find({ action: "rx.view" }).toArray();

describe("GET /api/prescriptions/[id]/file", () => {
  it("serves the owner's image with the stored type and locked-down headers, audited", async () => {
    const { id, cookie, user } = await uploaded();
    const res = await fileOf(id, cookie);
    expect(res.status).toBe(200);
    expect(Object.fromEntries(res.headers)).toMatchObject({
      "content-type": "image/webp",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'; img-src 'self'",
      "content-disposition": 'inline; filename="prescription.webp"',
      "cross-origin-resource-policy": "same-origin",
      "referrer-policy": "no-referrer",
    });
    const body = new Uint8Array(await res.arrayBuffer());
    expect(res.headers.get("content-length")).toBe(String(body.byteLength));
    const rx = await (await getDb()).collection(PRESCRIPTIONS_COLLECTION).findOne({});
    expect(
      Buffer.from(body).equals(Buffer.from((await getDeps().files.get(rx!.file.key))!.body)),
    ).toBe(true);
    expect(await views()).toEqual([
      expect.objectContaining({
        action: "rx.view",
        actor: { type: "user", userId: user._id, role: "customer" },
        target: { type: "prescription", id },
      }),
    ]);
  });

  it("serves a PDF as application/pdf, and takes the type from the record, not the store", async () => {
    const { id, cookie } = await uploaded(pdf());
    const files = getDeps().files;
    setDepsForTests({
      files: {
        ...files,
        get: async (k, o) => ({ ...(await files.get(k, o))!, contentType: "text/html" }),
      },
    });
    const res = await fileOf(id, cookie);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="prescription.pdf"');
  });

  it("answers 401 without a session", async () => {
    const { id } = await uploaded();
    expect((await fileOf(id)).status).toBe(401);
  });

  // Review Focus 4: every refused read is the same 404 and writes no audit row.
  it("answers the same 404 for another user, a malformed id, a deleted record and a staff customer session", async () => {
    const { id } = await uploaded();
    const other = await signedIn();
    const pharmacist = await signedIn();
    // Promoted after signing in, without the revoke setUserRole does: a customer-kind session.
    await (
      await getDb()
    )
      .collection(USERS_COLLECTION)
      .updateOne({ _id: pharmacist.user._id }, { $set: { role: "pharmacist" } });
    const staffSession = await signedIn({ role: "pharmacist" }); // staff-kind session
    const cases = [
      await fileOf(id, other.cookie),
      await fileOf("x", other.cookie),
      await fileOf(id.toUpperCase(), other.cookie),
      await fileOf(id, pharmacist.cookie),
      await fileOf(id, staffSession.cookie),
    ];
    await (await getDb()).collection(PRESCRIPTIONS_COLLECTION).deleteMany({});
    const owner = await uploaded();
    await (await getDb()).collection(PRESCRIPTIONS_COLLECTION).deleteMany({});
    cases.push(await fileOf(owner.id, owner.cookie));
    for (const res of cases) {
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toBe("application/json");
      expect(await json(res)).toEqual({ error: "not_found" });
    }
    expect(await views()).toEqual([]);
  });

  it("fails closed: if the rx.view audit write fails, it answers 500 and sends no bytes", async () => {
    const { id, cookie } = await uploaded();
    const real = Collection.prototype.insertOne;
    vi.spyOn(Collection.prototype, "insertOne").mockImplementation(function (
      this: InstanceType<typeof Collection>,
      ...args: Parameters<typeof real>
    ) {
      if (this.collectionName === AUDIT) return Promise.reject(new Error("audit down"));
      return real.apply(this, args);
    } as typeof real);
    const res = await fileOf(id, cookie);
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await json(res)).toEqual({ error: "internal_error" });
  });

  it("limits each user to 120 reads an hour (429 with Retry-After)", async () => {
    const { id, cookie, user } = await uploaded();
    const key = `rx-file:user:${user._id.toHexString()}`;
    for (let i = 0; i < 120; i++) {
      await hitRateLimit({ key, limit: 120, windowMs: 3_600_000, now: getDeps().now() });
    }
    const res = await fileOf(id, cookie);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
