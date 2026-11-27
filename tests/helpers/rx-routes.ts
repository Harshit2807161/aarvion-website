import { afterEach, beforeEach, expect, vi } from "vitest";
import { PUT } from "@/app/api/prescriptions/staging/[id]/route";
import { POST as STAGE } from "@/app/api/prescriptions/staging/route";
import { SESSIONS_COLLECTION } from "@/server/auth/sessions";
import { USERS_COLLECTION } from "@/server/auth/users";
import { installClock } from "./clock";
import { bytesPut, jsonPost } from "./http";
import { clearCollections } from "./mongo";
import { PATIENT, setupRxUploadHarness } from "./rx-upload";

/**
 * Shared setup for the prescription route tests: the upload harness (memory replica set, memory
 * files), a test clock at 10:00 UTC, clean users and sessions, and a console spy that fails any
 * test whose routes logged the patient name (routes log ids only).
 */
export function setupRxRouteHarness(): void {
  setupRxUploadHarness();
  let logs: ReturnType<typeof vi.spyOn>[] = [];
  beforeEach(async () => {
    installClock("2026-11-27T10:00:00Z");
    await clearCollections(USERS_COLLECTION, SESSIONS_COLLECTION);
    logs = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
  });
  afterEach(() => {
    const logged = JSON.stringify(logs.flatMap((s) => s.mock.calls));
    vi.restoreAllMocks();
    expect(logged).not.toContain(PATIENT);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read arbitrary response JSON
export const json = async (res: Response) => (await res.json()) as Record<string, any>;
/** A dynamic route's second argument. */
export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

export const stageReq = (cookie?: string) =>
  jsonPost("/api/prescriptions/staging", undefined, { cookie });
export const putReq = (id: string, bytes: Uint8Array, opts: Parameters<typeof bytesPut>[2] = {}) =>
  bytesPut(`/api/prescriptions/staging/${id}`, bytes, opts);

/** A slot from the staging route, then `bytes` through the PUT route (both must succeed). */
export async function stagedViaRoutes(cookie: string, bytes: Uint8Array) {
  const res = await STAGE(stageReq(cookie));
  expect(res.status).toBe(201);
  const slot = (await json(res)) as { stagingId: string; mode: string; pathname: string };
  expect((await PUT(putReq(slot.stagingId, bytes, { cookie }), ctx(slot.stagingId))).status).toBe(
    204,
  );
  return slot;
}
