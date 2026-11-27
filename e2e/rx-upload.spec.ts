import { expect, test, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";

/**
 * Preview smoke for the prescription upload against the built server (`pnpm build && pnpm start`,
 * FILE_STORE=memory): a PNG and a one-page PDF each go staging → PUT → finalise → list → file. The
 * PDF path proves the worker-thread check (pdf-lib, loaded at run time) works in the production
 * build, which unit and int tests cannot.
 */
const ORIGIN = "http://localhost:3100";
const headers = (ip: string) => ({
  "content-type": "application/json",
  "x-real-ip": ip,
  origin: ORIGIN,
});

async function signIn(request: APIRequestContext, ip: string) {
  const email = `e2e-rx-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  const send = await request.post("/api/auth/otp/send", {
    headers: headers(ip),
    data: { channel: "email", identifier: email },
  });
  expect(send.status()).toBe(200);
  const outbox = await request.get(`/dev/outbox?to=${encodeURIComponent(email)}`);
  const { messages } = (await outbox.json()) as { messages: { payload: { text: string } }[] };
  const code = /\d{6}/.exec(messages.at(-1)!.payload.text)![0];
  const signup = { name: "E2E Rx", adult: true, termsPrivacy: true, marketing: false };
  const verify = await request.post("/api/auth/otp/verify", {
    headers: headers(ip),
    data: { channel: "email", identifier: email, code, signup },
  });
  expect(verify.status()).toBe(200);
}

async function upload(request: APIRequestContext, ip: string, bytes: Buffer) {
  const staging = await request.post("/api/prescriptions/staging", { headers: headers(ip) });
  expect(staging.status()).toBe(201);
  const slot = (await staging.json()) as { stagingId: string; mode: string };
  expect(slot.mode).toBe("direct");
  const put = await request.put(`/api/prescriptions/staging/${slot.stagingId}`, {
    headers: { ...headers(ip), "content-type": "application/octet-stream" },
    data: bytes,
  });
  expect(put.status()).toBe(204);
  const done = await request.post("/api/prescriptions", {
    headers: headers(ip),
    data: { stagingId: slot.stagingId, patientName: "Asha Rao", declaration: true },
  });
  expect(done.status()).toBe(201);
  return ((await done.json()) as { rx: { id: string; kind: string; status: string } }).rx;
}

const onePagePdf = () =>
  Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
      "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n" +
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\n" +
      "trailer\n<< /Root 1 0 R /Size 4 >>\nstartxref\n0\n%%EOF\n",
    "latin1",
  );

test("a PNG and a one-page PDF upload end to end against the built server", async ({ page }) => {
  const ip = `198.51.100.${1 + Math.floor(Math.random() * 254)}`;
  const request = page.request;
  await signIn(request, ip);

  const png = await sharp({
    create: { width: 1200, height: 1600, channels: 3, background: { r: 230, g: 225, b: 215 } },
  })
    .png()
    .toBuffer();
  const image = await upload(request, ip, png);
  expect(image).toMatchObject({ kind: "image", status: "under_review" });
  const pdf = await upload(request, ip, onePagePdf());
  expect(pdf).toMatchObject({ kind: "pdf", status: "under_review" });

  const list = (await (await request.get("/api/prescriptions")).json()) as {
    items: { id: string }[];
  };
  expect(list.items.map((i) => i.id)).toEqual([pdf.id, image.id]);

  for (const [rx, type] of [
    [image, "image/webp"],
    [pdf, "application/pdf"],
  ] as const) {
    const file = await request.get(`/api/prescriptions/${rx.id}/file`);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toBe(type);
    expect(file.headers()["x-content-type-options"]).toBe("nosniff");
    expect(file.headers()["content-security-policy"]).toContain("sandbox");
  }
});
