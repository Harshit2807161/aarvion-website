import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

/**
 * The /login page end to end, by email, against the seeded e2e server (mock providers, so codes
 * are read from /dev/outbox). Each run uses a fresh address and its own client IP (`x-real-ip`),
 * so the per-identifier and per-IP limits never collide with other specs.
 */

async function lastCode(request: APIRequestContext, email: string, after = 0): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(async () => {
      const res = await request.get(`/dev/outbox?to=${encodeURIComponent(email)}`);
      const { messages } = (await res.json()) as { messages: { payload: { text: string } }[] };
      if (messages.length <= after) return undefined;
      code = /\d{6}/.exec(messages.at(-1)!.payload.text)?.[0];
      return code;
    })
    .toMatch(/^\d{6}$/);
  return code!;
}

async function outboxCount(request: APIRequestContext, email: string): Promise<number> {
  const res = await request.get(`/dev/outbox?to=${encodeURIComponent(email)}`);
  return ((await res.json()) as { messages: unknown[] }).messages.length;
}

async function sendByEmail(page: Page, email: string) {
  await page.locator('label[for="pg-via-email"]').click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Enter the code" })).toBeVisible();
}

test("a new address signs up, then signs in again without the profile step", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(90_000);
  const email = `e2e-login-${Date.now()}@example.test`;
  await page.setExtraHTTPHeaders({
    "x-real-ip": `198.51.100.${1 + Math.floor(Math.random() * 254)}`,
  });

  // Send → code → profile → consent → Create → home, signed in.
  await page.goto("/login");
  await sendByEmail(page, email);
  await page.getByLabel("6-digit code").fill(await lastCode(request, email));
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Full name").fill("E2E Shopper");
  await page.getByRole("checkbox", { name: "I am 18 or older" }).check();
  await page.getByRole("checkbox", { name: /^I agree to the Terms of use/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "You’re signed in" })).toBeVisible();
  await page.waitForURL("/");
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name === "__Host-aarv_sid")).toBe(true);

  // Log out through the API, then sign in again: a known address skips the profile step. The
  // first code was sent under 30 s ago, so the flow opens on the resend countdown.
  const logout = await page.evaluate(
    async () => (await fetch("/api/auth/logout", { method: "POST" })).status,
  );
  expect(logout).toBe(204);
  await page.goto("/login");
  const before = await outboxCount(request, email);
  await sendByEmail(page, email);
  await page.getByRole("button", { name: "Send a new code" }).click({ timeout: 40_000 });
  await page.getByLabel("6-digit code").fill(await lastCode(request, email, before));
  await expect(page.getByRole("heading", { name: "You’re signed in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create your account" })).toHaveCount(0);
  await page.waitForURL("/");

  // Signed in, /login completes at once, and an unsafe next never leaves the site.
  for (const next of ["//evil.com", "/.//evil.com"]) {
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page.waitForURL("/");
  }
});

test("/login is noindex and, where mocks are allowed, opens a demo state", async ({ page }) => {
  // The e2e server allows mocks (ALLOW_MOCKS_IN_PROD_BUILD=1), so the page passes allowDemo; in
  // production isMockForbidden() is true and ?state= is ignored (login-flow.test.tsx pins that).
  await page.goto("/login?state=otp-locked");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText(/^Too many wrong codes, so this code no longer works/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify and sign in" })).toHaveCount(0);
  await expect(page.locator('a[href*="/dev/"]')).toHaveCount(0);
});

test("the header Sign in opens the dialog, signs a new address up and shows the account", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const email = `e2e-dialog-${Date.now()}@example.test`;
  await page.setExtraHTTPHeaders({
    "x-real-ip": `198.51.100.${1 + Math.floor(Math.random() * 254)}`,
  });
  // The pill asks for the session once hydrated and idle; click only after that, or the plain
  // link would navigate to /login.
  const asked = page.waitForResponse((r) => r.url().endsWith("/api/auth/session"));
  await page.goto("/legal/terms");
  await asked;
  const pill = page.locator("[data-account-pill]");
  await pill.click();
  const dialog = page.getByRole("dialog", { name: "Sign in" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/legal\/terms$/);
  // It opens on the mobile field, and closing gives focus back to the pill.
  await expect(dialog.getByLabel("Mobile number")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
  await pill.click();
  await expect(dialog).toBeVisible();

  await dialog.locator('label[for="dlg-via-email"]').click();
  await dialog.getByLabel("Email address").fill(email);
  await dialog.getByRole("button", { name: "Send code" }).click();
  await dialog.getByLabel("6-digit code").fill(await lastCode(request, email));
  await dialog.getByLabel("Full name").fill("E2E Dialog");
  await dialog.getByRole("checkbox", { name: "I am 18 or older" }).check();
  await dialog.getByRole("checkbox", { name: /^I agree to the Terms of use/ }).check();
  await dialog.getByRole("button", { name: "Create account" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Signed in as E2E")).toBeVisible();
  await expect(page.locator("[data-account-pill]")).toHaveAccessibleName("Your account");
  await expect(page).toHaveURL(/\/legal\/terms$/);
});

test("at 390px the sign-in dialog is a bottom sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const asked = page.waitForResponse((r) => r.url().endsWith("/api/auth/session"));
  await page.goto("/legal/terms");
  await asked;
  await page.locator("[data-account-pill]").click();
  const dialog = page.getByRole("dialog", { name: "Sign in" });
  await expect(dialog).toBeVisible();
  // The sheet slides up; wait until it rests on the bottom edge.
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box ? Math.round(box.y + box.height) : null;
    })
    .toBe(844);
});
