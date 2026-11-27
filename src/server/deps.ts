import { getEnv } from "./env.ts";
import { isMockForbidden } from "./providers/guard.ts";
import { createFakePayments } from "./providers/fake-payments.ts";
import { createFileStore } from "./providers/file-store.ts";
import { mockEmail } from "./providers/mock-email.ts";
import { mockSms } from "./providers/mock-sms.ts";
import type { Deps } from "./providers/types.ts";

export type { Deps } from "./providers/types.ts";
export { readOutbox, type OutboxMessage } from "./providers/outbox.ts";

let cached: Deps | undefined;
let overrides: Partial<Deps> = {};

function build(): Deps {
  const env = getEnv();
  // The file store is not in this eager check: it resolves on first use and refuses dev stores
  // there (providers/file-store.ts), so a mis-set FILE_STORE cannot fail every route.
  const usesMocks =
    env.SMS_PROVIDER === "mock" ||
    env.EMAIL_PROVIDER === "mock" ||
    env.PAYMENTS_PROVIDER === "fake";
  if (usesMocks && isMockForbidden()) {
    throw new Error(
      "Mock providers are not allowed in production: set SMS_PROVIDER, EMAIL_PROVIDER and PAYMENTS_PROVIDER to real providers.",
    );
  }

  if (env.SMS_PROVIDER !== "mock")
    throw new Error(`SMS_PROVIDER=${env.SMS_PROVIDER}: not implemented yet`);
  if (env.EMAIL_PROVIDER !== "mock")
    throw new Error(`EMAIL_PROVIDER=${env.EMAIL_PROVIDER}: not implemented yet`);
  if (env.PAYMENTS_PROVIDER !== "fake")
    throw new Error(`PAYMENTS_PROVIDER=${env.PAYMENTS_PROVIDER}: not implemented yet`);
  return {
    sms: mockSms,
    email: mockEmail,
    payments: createFakePayments(),
    files: createFileStore(env),
    now: () => new Date(),
  };
}

export function getDeps(): Deps {
  cached ??= build();
  return { ...cached, ...overrides };
}

export function setDepsForTests(partial: Partial<Deps>): void {
  overrides = { ...overrides, ...partial };
}

export function resetDepsForTests(): void {
  cached = undefined;
  overrides = {};
}
