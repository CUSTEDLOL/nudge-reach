import { envSchema, type Env } from "@/lib/env-schema";

/**
 * Environment validation, run once at boot (imported from app/layout.tsx).
 * Fails fast with a readable error instead of crashing mid-request.
 *
 * Skipped during `next build` (no secrets in CI) and when
 * SKIP_ENV_VALIDATION=1 is set explicitly.
 */
function loadEnv(): Env {
  const skip =
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.NEXT_PHASE === "phase-production-build";
  if (skip) {
    return process.env as unknown as Env;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${problems}\n` +
        `Copy .env.example to .env.local and fill in the values.`
    );
  }
  return parsed.data;
}

export const env = loadEnv();
