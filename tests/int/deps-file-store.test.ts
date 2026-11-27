import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as SEND } from "@/app/api/auth/otp/send/route";
import { POST as VERIFY } from "@/app/api/auth/otp/verify/route";
import { getDeps, resetDepsForTests } from "@/server/deps";
import { EnvError, resetEnvForTests } from "@/server/env";
import { DEFAULT_SIGNUP } from "../helpers/auth";
import { jsonPost } from "../helpers/http";
import { startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";
import { lastOtpCode } from "../helpers/otp";

/**
 * Review R3 I1: a mis-set file store must not take login down with it. On a Vercel-like preview
 * (VERCEL_ENV set, mocks allowed) with FILE_STORE left at its default, OTP send and verify still
 * work, and only the first file access fails, with an EnvError that names the cause.
 */
const PHONE = "+919812345678";

function previewEnv() {
  vi.stubEnv("OTP_PEPPER", "x".repeat(64));
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("ALLOW_MOCKS_IN_PROD_BUILD", "1");
  vi.stubEnv("FILE_STORE", "");
  resetEnvForTests();
  resetDepsForTests();
}

beforeAll(async () => {
  previewEnv();
  await startMemoryReplSet();
  previewEnv();
}, 120_000);
afterAll(async () => {
  resetDepsForTests();
  await stopMemoryReplSet();
  vi.unstubAllEnvs();
  resetEnvForTests();
});
beforeEach(previewEnv);

describe("file store misconfigured on a Vercel preview", () => {
  it("still sends and verifies an OTP", async () => {
    const sent = await SEND(
      jsonPost(
        "/api/auth/otp/send",
        { channel: "phone", identifier: PHONE },
        { ip: "203.0.113.7" },
      ),
    );
    expect(sent.status).toBe(200);
    const code = await lastOtpCode(PHONE);
    const verified = await VERIFY(
      jsonPost(
        "/api/auth/otp/verify",
        { channel: "phone", identifier: PHONE, code, signup: DEFAULT_SIGNUP },
        { ip: "203.0.113.7" },
      ),
    );
    expect(verified.status).toBe(200);
  });

  it("fails the first file access with an EnvError naming the store", async () => {
    const err = await getDeps()
      .files.get("rx/u/a.webp")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EnvError);
    expect((err as Error).message).toBe(
      "FILE_STORE=memory does not persist across Vercel functions: use blob",
    );
  });
});
