import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/otp/send/route";
import { OTP_COLLECTION } from "@/server/auth/otp";
import { USERS_COLLECTION, findOrCreateUserByIdentifier } from "@/server/auth/users";
import { getDb } from "@/server/db/client";
import { readOutbox, resetDepsForTests, setDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { resetEnvForTests } from "@/server/env";
import { mockSms } from "@/server/providers/mock-sms";
import { OUTBOX_COLLECTION } from "@/server/providers/outbox";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { installClock } from "../helpers/clock";
import { jsonPost } from "../helpers/http";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";
import { lastOtpCode } from "../helpers/otp";

const PATH = "/api/auth/otp/send";
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
  );
});

const send = (body: unknown, opts?: Parameters<typeof jsonPost>[2]) =>
  POST(jsonPost(PATH, body, opts));
const sendPhone = (identifier = PHONE, opts?: Parameters<typeof jsonPost>[2]) =>
  send({ channel: "phone", identifier }, opts);
const rateDocs = async () => (await getDb()).collection(RATE_LIMITS_COLLECTION).countDocuments();

describe("POST /api/auth/otp/send", () => {
  it("sends an SMS code", async () => {
    const res = await sendPhone();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, resendAfterSec: 30 });
    const out = await readOutbox(PHONE);
    expect(out).toHaveLength(1);
    const p = out[0]!.payload as { templateId: string; vars: { code: string; minutes: string } };
    expect(p.templateId).toBe("otp");
    expect(p.vars.code).toMatch(/^\d{6}$/);
    expect(p.vars.minutes).toBe("5");
  });

  it("never returns the code in the response", async () => {
    const res = await sendPhone();
    const text = await res.text();
    expect(text).not.toContain(await lastOtpCode(PHONE));
  });

  it("sends an email code with the agreed copy", async () => {
    const res = await send({ channel: "email", identifier: "  A@Example.com " });
    expect(res.status).toBe(200);
    const [m] = await readOutbox("a@example.com");
    const p = m!.payload as { subject: string; text: string };
    expect(p.subject).toBe("Your Aarvion login code");
    expect(p.text).toContain(await lastOtpCode("a@example.com"));
    expect(p.text).toContain("5 minutes");
    expect(p.text).toContain("Aarvion staff will never ask you for this code.");
  });

  it("answers identically whether or not the account exists", async () => {
    await findOrCreateUserByIdentifier({ channel: "phone", value: PHONE }, clock.now());
    const a = await sendPhone(PHONE);
    const b = await sendPhone("+919812345678");
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await a.json()).toEqual(await b.json());
  });

  it.each([
    [{ channel: "phone", identifier: "+1 2025550123" }],
    [{ channel: "phone", identifier: "5876543210" }],
    [{ channel: "email", identifier: "not-an-email" }],
  ])("400 invalid_identifier for %j, with no send and no budget spent", async (body) => {
    const res = await send(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_identifier" });
    expect(await (await getDb()).collection(OUTBOX_COLLECTION).countDocuments()).toBe(0);
    expect(await rateDocs()).toBe(0);
  });

  it("400 invalid_request for a bad body shape", async () => {
    const res = await send({ channel: "fax", identifier: "x" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
  });

  it("403 for a foreign Origin and sends nothing", async () => {
    const res = await sendPhone(PHONE, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(await readOutbox(PHONE)).toHaveLength(0);
    expect(await rateDocs()).toBe(0);
  });

  it("415 for a non-JSON content type", async () => {
    const res = await sendPhone(PHONE, { contentType: "text/plain" });
    expect(res.status).toBe(415);
  });

  it("429 resend_cooldown within 30 s, without spending identifier budget", async () => {
    expect((await sendPhone()).status).toBe(200);
    clock.advance(10_000);
    const res = await sendPhone();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("20");
    expect(await res.json()).toEqual({ error: "resend_cooldown", retryAfterSec: 20 });
    const doc = await (
      await getDb()
    )
      .collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION)
      .findOne({ _id: `otp-send:id:phone:${PHONE}` });
    expect(doc?.count).toBe(1);
    expect(await readOutbox(PHONE)).toHaveLength(1);
  });

  it("limits to 3 per identifier per 10 minutes", async () => {
    for (const offset of [0, 31_000, 31_000]) {
      clock.advance(offset);
      expect((await sendPhone()).status).toBe(200);
    }
    clock.advance(31_000);
    const res = await sendPhone();
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string; retryAfterSec: number };
    expect(body.error).toBe("rate_limited");
    expect(body.retryAfterSec).toBeGreaterThan(0);
    expect(res.headers.get("retry-after")).toBe(String(body.retryAfterSec));
    clock.advance(600_000 - 93_000);
    expect((await sendPhone()).status).toBe(200);
  });

  it("limits to 20 per IP per hour", async () => {
    for (let n = 0; n < 20; n++) {
      const res = await sendPhone(`+9198765432${String(n).padStart(2, "0")}`, {
        ip: "203.0.113.9",
      });
      expect(res.status).toBe(200);
    }
    const res = await sendPhone("+919876543299", { ip: "203.0.113.9" });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
    expect((await sendPhone("+919876543298", { ip: "203.0.113.11" })).status).toBe(200);
  });

  it("buckets IPv6 by /64", async () => {
    for (let n = 0; n < 20; n++) {
      const res = await sendPhone(`+9198765432${String(n).padStart(2, "0")}`, {
        ip: `2001:db8:1:2::${n + 1}`,
      });
      expect(res.status).toBe(200);
    }
    const same64 = await sendPhone("+919876543290", { ip: "2001:db8:1:2:ffff::1" });
    expect(same64.status).toBe(429);
    const other64 = await sendPhone("+919876543291", { ip: "2001:db8:1:3::1" });
    expect(other64.status).toBe(200);
  });

  it("gives hex and dotted IPv4-mapped forms of one client the same IPv4 bucket", async () => {
    const forms = [
      "::ffff:203.0.113.7",
      "::ffff:cb00:7107",
      "0:0:0:0:0:ffff:cb00:7107",
      "203.0.113.7",
    ];
    for (let n = 0; n < 20; n++) {
      const res = await sendPhone(`+9198765432${String(n).padStart(2, "0")}`, {
        ip: forms[n % forms.length]!,
      });
      expect(res.status).toBe(200);
    }
    const res = await sendPhone("+919876543290", { ip: "::ffff:cb00:7107" });
    expect(res.status).toBe(429);
  });

  it("503 delivery_failed deletes the challenge so an immediate resend works (F12)", async () => {
    setDepsForTests({
      sms: {
        send: async () => {
          throw new Error("provider down");
        },
      },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await sendPhone();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "delivery_failed" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("provider down");
    spy.mockRestore();
    setDepsForTests({ sms: mockSms });
    expect((await sendPhone()).status).toBe(200);
  });

  it("never logs the code", async () => {
    const logs = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
    ];
    await sendPhone();
    const code = await lastOtpCode(PHONE);
    for (const l of logs) {
      expect(JSON.stringify(l.mock.calls)).not.toContain(code);
      l.mockRestore();
    }
  });

  it("500 server_misconfigured when OTP_PEPPER is unset", async () => {
    vi.stubEnv("OTP_PEPPER", "");
    resetEnvForTests();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await sendPhone();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_misconfigured" });
    spy.mockRestore();
  });
});
