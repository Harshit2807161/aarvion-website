import { getEnv } from "./env.ts";
import { isMockForbidden } from "./providers/guard.ts";
import { createFakePayments } from "./providers/fake-payments.ts";
import { createLocalFiles } from "./providers/local-files.ts";
import { createMemoryFiles } from "./providers/memory-files.ts";
import { mockEmail } from "./providers/mock-email.ts";
import { mockSms } from "./providers/mock-sms.ts";
import type { Deps, FileStore } from "./providers/types.ts";

export type { Deps } from "./providers/types.ts";
export { readOutbox, type OutboxMessage } from "./providers/outbox.ts";

let cached: Deps | undefined;
let overrides: Partial<Deps> = {};

function build(): Deps {
  const env = getEnv();
  const usesMocks =
    env.SMS_PROVIDER === "mock" ||
    env.EMAIL_PROVIDER === "mock" ||
    env.PAYMENTS_PROVIDER === "fake" ||
    env.FILE_STORE === "memory" ||
    // A disk store is a dev tool too: production files must live in the private Blob store.
    env.FILE_STORE === "local";
  if (usesMocks && isMockForbidden()) {
    throw new Error(
      "Mock providers are not allowed in production: set SMS_PROVIDER, EMAIL_PROVIDER, PAYMENTS_PROVIDER and FILE_STORE to real providers.",
    );
  }

  if (env.SMS_PROVIDER !== "mock")
    throw new Error(`SMS_PROVIDER=${env.SMS_PROVIDER}: not implemented yet`);
  if (env.EMAIL_PROVIDER !== "mock")
    throw new Error(`EMAIL_PROVIDER=${env.EMAIL_PROVIDER}: not implemented yet`);
  if (env.PAYMENTS_PROVIDER !== "fake")
    throw new Error(`PAYMENTS_PROVIDER=${env.PAYMENTS_PROVIDER}: not implemented yet`);
  // Each Vercel function has its own memory and a read-only disk, so a file written by one
  // request would be missing in the next: previews must use Blob as well as production.
  if (env.VERCEL_ENV !== undefined && env.FILE_STORE !== "blob") {
    throw new Error(
      `FILE_STORE=${env.FILE_STORE} does not persist across Vercel functions: use blob`,
    );
  }

  return {
    sms: mockSms,
    email: mockEmail,
    payments: createFakePayments(),
    files: buildFiles(env),
    now: () => new Date(),
  };
}

function buildFiles(env: ReturnType<typeof getEnv>): FileStore {
  if (env.FILE_STORE === "blob") throw new Error("FILE_STORE=blob: not implemented yet");
  if (env.FILE_STORE === "local") return createLocalFiles(env.FILE_STORE_LOCAL_DIR);
  return createMemoryFiles();
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
