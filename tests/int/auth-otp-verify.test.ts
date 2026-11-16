import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as SEND } from "@/app/api/auth/otp/send/route";
import { POST as VERIFY } from "@/app/api/auth/otp/verify/route";
import { OTP_COLLECTION } from "@/server/auth/otp";
import {
  SESSIONS_COLLECTION,
  createSession,
  hashSessionToken,
  resolveSession,
} from "@/server/auth/sessions";
import { USERS_COLLECTION, type UserDoc } from "@/server/auth/users";
import { getDb } from "@/server/db/client";
import { resetDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { resetEnvForTests } from "@/server/env";
import { OUTBOX_COLLECTION } from "@/server/providers/outbox";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { installClock } from "../helpers/clock";
import { jsonPost, sessionTokenFrom } from "../helpers/http";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";
import { lastOtpCode } from "../helpers/otp";

const SEND_PATH = "/api/auth/otp/send";
const PATH = "/api/auth/otp/verify";
const PHONE = "+919876543210";
let clock: ReturnType<typeof installClock>;

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
  clock = installClock("2026-11-17T04:30:00Z");
  await clearCollections(
    OTP_COLLECTION,
    RATE_LIMITS_COLLECTION,
    OUTBOX_COLLECTION,
    USERS_COLLECTION,
    SESSIONS_COLLECTION,
  );
});

const send = (identifier = PHONE, ip = "203.0.113.10") =>
  SEND(jsonPost(SEND_PATH, { channel: "phone", identifier }, { ip }));
const verify = (code: string, opts?: Parameters<typeof jsonPost>[2], identifier = PHONE) =>
  VERIFY(jsonPost(PATH, { channel: "phone", identifier, code }, opts));
const count = async (name: string) => (await getDb()).collection(name).countDocuments();
const WRONG = (right: string) => (right === "000000" ? "111111" : "000000");

/** Sends and returns the delivered code. */
async function sendAndRead(identifier = PHONE): Promise<string> {
  expect((await send(identifier)).status).toBe(200);
  return lastOtpCode(identifier);
}

describe("POST /api/auth/otp/verify", () => {
  it("logs a new customer in with a hardened cookie", async () => {
    const code = await sendAndRead();
    const res = await verify(code);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { user: { id: string }; isNewUser: boolean };
    expect(body).toEqual({
      user: {
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        phone: PHONE,
        email: null,
        role: "customer",
      },
      isNewUser: true,
    });
    expect(res.headers.get("set-cookie")).toMatch(
      /^__Host-aarv_sid=[A-Za-z0-9_-]{43}; Path=\/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax$/,
    );
    expect(await count(USERS_COLLECTION)).toBe(1);
    expect(await count(SESSIONS_COLLECTION)).toBe(1);
  });

  it("never returns the session token or the code in the body", async () => {
    const code = await sendAndRead();
    const res = await verify(code);
    const token = sessionTokenFrom(res)!;
    const text = await res.text();
    expect(text).not.toContain(token);
    expect(text).not.toContain(code);
  });

  it("a second login is not a new user and keeps the id", async () => {
    const first = await verify(await sendAndRead());
    const firstId = ((await first.json()) as { user: { id: string } }).user.id;
    clock.advance(31_000);
    const second = await verify(await sendAndRead());
    expect(second.status).toBe(200);
    const body = (await second.json()) as { user: { id: string }; isNewUser: boolean };
    expect(body.isNewUser).toBe(false);
    expect(body.user.id).toBe(firstId);
    expect(await count(USERS_COLLECTION)).toBe(1);
  });

  it("signs in by email", async () => {
    expect(
      (await SEND(jsonPost(SEND_PATH, { channel: "email", identifier: "A@Example.com" }))).status,
    ).toBe(200);
    const code = await lastOtpCode("a@example.com");
    const res = await VERIFY(
      jsonPost(PATH, { channel: "email", identifier: " a@example.com", code }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: { email: string } }).user.email).toBe("a@example.com");
  });

  it("collapses every failure into the same 400 invalid_code", async () => {
    const code = await sendAndRead();
    const wrong = await verify(WRONG(code));
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toEqual({ error: "invalid_code" });
    expect(wrong.headers.get("set-cookie")).toBeNull();

    const never = await verify("123456", undefined, "+919812345678");
    expect(never.status).toBe(400);
    expect(await never.json()).toEqual({ error: "invalid_code" });

    // F6: a malformed code is the same answer, not invalid_request.
    for (const bad of ["12345", "1234567", "abcdef", " 12345", ""]) {
      const res = await verify(bad);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_code" });
    }
  });

  it("rejects an expired code and a reused code", async () => {
    const code = await sendAndRead();
    clock.advance(300_000);
    const late = await verify(code);
    expect(late.status).toBe(400);
    expect(await late.json()).toEqual({ error: "invalid_code" });

    clock.advance(31_000);
    const fresh = await sendAndRead();
    expect((await verify(fresh)).status).toBe(200);
    const again = await verify(fresh);
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: "invalid_code" });
  });

  it("races: two verifies with the right code give one 200 and one 400, one session", async () => {
    const code = await sendAndRead();
    const results = await Promise.all([verify(code), verify(code)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(await count(SESSIONS_COLLECTION)).toBe(1);
    expect(await count(USERS_COLLECTION)).toBe(1);
  });

  it("brute force across challenges: 10 failures per identifier per 24 h, then 429", async () => {
    let code = await sendAndRead();
    for (let n = 0; n < 5; n++) expect((await verify(WRONG(code))).status).toBe(400);
    clock.advance(31_000);
    code = await sendAndRead();
    for (let n = 0; n < 5; n++) expect((await verify(WRONG(code))).status).toBe(400);
    clock.advance(31_000);
    code = await sendAndRead();
    const blocked = await verify(code);
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { error: string; retryAfterSec: number };
    expect(body.error).toBe("too_many_attempts");
    expect(body.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.headers.get("retry-after")).toBe(String(body.retryAfterSec));
    expect(blocked.headers.get("set-cookie")).toBeNull();
    expect(await count(SESSIONS_COLLECTION)).toBe(0);

    clock.advance(24 * 3_600_000);
    code = await sendAndRead();
    expect((await verify(code)).status).toBe(200);
  });

  it("a different identifier is unaffected by another's lockout", async () => {
    for (let n = 0; n < 10; n++) {
      if (n % 5 === 0) await sendAndRead();
      await verify("000000");
      if (n % 5 === 4) clock.advance(31_000);
    }
    const other = "+919812345678";
    const code = await sendAndRead(other);
    expect((await verify(code, undefined, other)).status).toBe(200);
  });

  it("fixation: an existing cookie's session is revoked and a fresh token is issued", async () => {
    const db = await getDb();
    const other = await db.collection<UserDoc>(USERS_COLLECTION).insertOne({
      phone: "+919800000000",
      role: "customer",
      createdAt: clock.now(),
      updatedAt: clock.now(),
      lastLoginAt: clock.now(),
    } as UserDoc);
    const { token: oldToken } = await createSession(
      { _id: other.insertedId, role: "customer" },
      clock.now(),
    );
    const code = await sendAndRead();
    const res = await verify(code, { cookie: `__Host-aarv_sid=${oldToken}` });
    expect(res.status).toBe(200);
    const fresh = sessionTokenFrom(res);
    expect(fresh).not.toBeNull();
    expect(fresh).not.toBe(oldToken);
    expect(await resolveSession(oldToken, clock.now())).toBeNull();
    expect(await resolveSession(fresh!, clock.now())).not.toBeNull();
  });

  it("fixation: an attacker-chosen token is never adopted", async () => {
    const chosen = "B".repeat(43);
    const code = await sendAndRead();
    const res = await verify(code, { cookie: `__Host-aarv_sid=${chosen}` });
    expect(res.status).toBe(200);
    expect(sessionTokenFrom(res)).not.toBe(chosen);
    const db = await getDb();
    expect(
      await db
        .collection<{ _id: string }>(SESSIONS_COLLECTION)
        .findOne({ _id: hashSessionToken(chosen) }),
    ).toBeNull();
  });

  it("a failed verify does not revoke the caller's existing session", async () => {
    const db = await getDb();
    const u = await db.collection(USERS_COLLECTION).insertOne({
      phone: "+919800000001",
      role: "customer",
      createdAt: clock.now(),
      updatedAt: clock.now(),
      lastLoginAt: clock.now(),
    });
    const { token } = await createSession({ _id: u.insertedId, role: "customer" }, clock.now());
    const code = await sendAndRead();
    expect((await verify(WRONG(code), { cookie: `__Host-aarv_sid=${token}` })).status).toBe(400);
    expect(await resolveSession(token, clock.now())).not.toBeNull();
  });

  it("staff get a session cookie without Max-Age and a staff session", async () => {
    const db = await getDb();
    await db.collection(USERS_COLLECTION).insertOne({
      phone: PHONE,
      role: "pharmacist",
      createdAt: clock.now(),
      updatedAt: clock.now(),
      lastLoginAt: clock.now(),
    });
    const res = await verify(await sendAndRead());
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(
      /^__Host-aarv_sid=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Lax$/,
    );
    expect(cookie).not.toContain("Max-Age");
    const s = await resolveSession(sessionTokenFrom(res)!, clock.now());
    expect(s?.session.kind).toBe("staff");
  });

  it("403 for a foreign Origin and leaves the challenge attempts unchanged", async () => {
    const code = await sendAndRead();
    const res = await verify(code, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    const doc = await (await getDb()).collection<{ attempts: number }>(OTP_COLLECTION).findOne({});
    expect(doc?.attempts).toBe(0);
    expect(await count(SESSIONS_COLLECTION)).toBe(0);
  });

  it("400 invalid_request for a bad body shape, 415 for a non-JSON type", async () => {
    const bad = await VERIFY(jsonPost(PATH, { channel: "fax", identifier: "x", code: "123456" }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "invalid_request" });
    expect((await verify("123456", { contentType: "text/plain" })).status).toBe(415);
  });

  it("400 invalid_code for an unparseable identifier", async () => {
    const res = await verify("123456", undefined, "5876543210");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_code" });
  });

  it("never logs the code or the session token", async () => {
    const logs = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
    ];
    const code = await sendAndRead();
    await verify(WRONG(code));
    const res = await verify(code);
    const token = sessionTokenFrom(res)!;
    for (const l of logs) {
      const out = JSON.stringify(l.mock.calls);
      expect(out).not.toContain(code);
      expect(out).not.toContain(token);
      l.mockRestore();
    }
  });
});
