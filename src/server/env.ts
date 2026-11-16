import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  MONGODB_DB: z.preprocess(emptyToUndefined, z.string().min(1).default("aarvion")),
  APP_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  VERCEL_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(["production", "preview", "development"]).optional(),
  ),
  SMS_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["mock", "msg91"]).default("mock")),
  EMAIL_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["mock", "resend"]).default("mock")),
  PAYMENTS_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["fake", "razorpay"]).default("fake")),
  FILE_STORE: z.preprocess(emptyToUndefined, z.enum(["memory", "local", "blob"]).default("memory")),
  OTP_PEPPER: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
  ALLOW_MOCKS_IN_PROD_BUILD: z.preprocess(emptyToUndefined, z.literal("1").optional()),
});

export type Env = z.infer<typeof schema>;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

let cached: Env | undefined;

/** Lazily parses process.env once. Never runs at import time. */
export function getEnv(): Env {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new EnvError(`Invalid environment variables:\n${lines.join("\n")}`);
  }
  cached = result.data;
  return cached;
}

export function resetEnvForTests(): void {
  cached = undefined;
}

/** Returns a required variable or throws an EnvError naming it. */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = getEnv()[key];
  if (value === undefined || value === null) {
    throw new EnvError(`Missing required environment variable ${key}`);
  }
  return value as NonNullable<Env[K]>;
}
