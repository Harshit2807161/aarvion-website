import { ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import type { Role } from "@/server/auth/roles";
import { getDeps, resetDepsForTests, setDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { resetEnvForTests } from "@/server/env";
import {
  PRESCRIPTIONS_COLLECTION,
  RX_STAGING_COLLECTION,
} from "@/server/prescriptions/prescriptions";
import { finishRxUpload, startRxUpload } from "@/server/prescriptions/upload";
import { createFileStore } from "@/server/providers/file-store";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "./mongo";

/** Shared setup for the prescription upload int tests: a memory replica set, memory files, a fixed clock. */
export const NOW = new Date("2026-11-27T10:00:00Z");
export const AUDIT = "audit_logs";
export const PATIENT = "Asha Kulkarni";
export const uid = () => new ObjectId();

export function setupRxUploadHarness(): void {
  beforeAll(async () => {
    vi.stubEnv("OTP_PEPPER", "x".repeat(64));
    resetEnvForTests();
    await startMemoryReplSet();
  }, 120_000);
  afterAll(async () => {
    resetDepsForTests();
    await stopMemoryReplSet();
    vi.unstubAllEnvs();
    resetEnvForTests();
  });
  beforeEach(async () => {
    vi.stubEnv("OTP_PEPPER", "x".repeat(64));
    resetEnvForTests();
    resetDepsForTests();
    setDepsForTests({ files: createFileStore({ FILE_STORE: "memory" } as never) });
    await clearCollections(
      PRESCRIPTIONS_COLLECTION,
      RX_STAGING_COLLECTION,
      RATE_LIMITS_COLLECTION,
      AUDIT,
    );
  });
}

export const finish = (
  userId: ObjectId,
  stagingId: string,
  now = NOW,
  role: Role = "customer",
  patientName = PATIENT,
) => finishRxUpload({ userId, role, body: { stagingId, patientName, declaration: true }, now });

/** Starts an upload and puts `bytes` at the slot's staged key. */
export async function stage(userId: ObjectId, bytes: Uint8Array) {
  const started = await startRxUpload({ userId, ipBucket: "1.2.3.4", now: NOW });
  if (!started.ok) throw new Error("start refused");
  await getDeps().files.put(started.key, bytes, "application/octet-stream");
  return started;
}

/** Wraps the file store to record every final (rx/...) put; `hooks` can fail or delay a call. */
export function trackFiles(hooks: Partial<ReturnType<typeof getDeps>["files"]> = {}) {
  const store = getDeps().files;
  const puts: string[] = [];
  setDepsForTests({
    files: {
      kind: store.kind,
      get: (p, o) => store.get(p, o),
      delete: (p) => store.delete(p),
      ...hooks,
      put: (p, b, t) => (puts.push(p), (hooks.put ?? store.put.bind(store))(p, b, t)),
    },
  });
  return { store, finals: () => puts.filter((k) => k.startsWith("rx/")) };
}
