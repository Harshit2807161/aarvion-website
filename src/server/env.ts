import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const appUrl = z.preprocess(emptyToUndefined, z.url().optional());
const vercelEnv = z.preprocess(
  emptyToUndefined,
  z.enum(["production", "preview", "development"]).optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  MONGODB_DB: z.preprocess(emptyToUndefined, z.string().min(1).default("aarvion")),
  APP_URL: appUrl,
  VERCEL_ENV: vercelEnv,
  SMS_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["mock", "msg91"]).default("mock")),
  EMAIL_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["mock", "resend"]).default("mock")),
  PAYMENTS_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["fake", "razorpay"]).default("fake")),
  FILE_STORE: z.preprocess(emptyToUndefined, z.enum(["memory", "local", "blob"]).default("memory")),
  /** Folder for FILE_STORE=local (pnpm dev); gitignored. */
  FILE_STORE_LOCAL_DIR: z.preprocess(emptyToUndefined, z.string().min(1).default(".data/files")),
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

/**
 * The two variables the SEO routes need, parsed on their own so an unrelated bad variable cannot
 * take down robots.txt, the sitemap or every product page. `VERCEL_ENV` is validated. `APP_URL` is
 * returned as given (blank is undefined), except in production, where a missing or invalid value
 * throws: a production site must never publish localhost canonicals or sitemap URLs. Lazy: it
 * throws only when called, never at import. Not cached, so tests can change the environment.
 */
export function getSiteEnv(): { appUrl: string | undefined; vercelEnv: Env["VERCEL_ENV"] } {
  const env = vercelEnv.safeParse(process.env.VERCEL_ENV);
  if (!env.success) {
    throw new EnvError(
      `Invalid environment variables:\nVERCEL_ENV: ${env.error.issues[0]?.message}`,
    );
  }
  const raw = emptyToUndefined(process.env.APP_URL?.trim());
  if (env.data === "production") {
    const url = appUrl.safeParse(raw);
    if (!url.success || url.data === undefined) {
      throw new EnvError(
        "APP_URL must be set to the site's public https URL when VERCEL_ENV is production",
      );
    }
  }
  return { appUrl: raw as string | undefined, vercelEnv: env.data };
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
