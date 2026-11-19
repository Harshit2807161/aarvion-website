import { expect, test } from "@playwright/test";

test("OTP login: send, read the code from the dev outbox, verify, /me, logout", async ({
  page,
  request,
  context,
}) => {
  await page.goto("/");
  const email = `e2e-${Date.now()}@example.test`;
  const ip = `198.51.100.${1 + Math.floor(Math.random() * 254)}`;

  const send = await page.evaluate(
    async ({ email, ip }) => {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": ip },
        body: JSON.stringify({ channel: "email", identifier: email }),
      });
      return { status: res.status, body: await res.json() };
    },
    { email, ip },
  );
  expect(send).toEqual({ status: 200, body: { ok: true, resendAfterSec: 30 } });

  const outbox = await request.get(`/dev/outbox?to=${encodeURIComponent(email)}`);
  expect(outbox.status()).toBe(200);
  const { messages } = (await outbox.json()) as { messages: { payload: { text: string } }[] };
  const code = /\d{6}/.exec(messages.at(-1)!.payload.text)?.[0];
  expect(code).toBeDefined();

  // The address is new, so the verify carries the sign-up details a first login needs from 38c on
  // (until then the server ignores them).
  const signup = { name: "E2E Shopper", adult: true, termsPrivacy: true, marketing: false };
  const verify = await page.evaluate(
    async ({ email, ip, code, signup }) => {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": ip },
        body: JSON.stringify({ channel: "email", identifier: email, code, signup }),
      });
      return { status: res.status, body: await res.json() };
    },
    { email, ip, code: code!, signup },
  );
  expect(verify.status).toBe(200);
  expect(verify.body.user.email).toBe(email);
  expect(verify.body.user.name).toBe("E2E Shopper");

  const cookie = (await context.cookies()).find((c) => c.name === "__Host-aarv_sid");
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });

  expect((await page.request.get("/api/auth/me")).status()).toBe(200);
  const logout = await page.request.post("/api/auth/logout", {
    headers: { origin: "http://localhost:3100" },
  });
  expect(logout.status()).toBe(204);
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
});
