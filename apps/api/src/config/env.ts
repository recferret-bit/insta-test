import { z } from "zod";

/**
 * API runtime configuration (`F-INFRA-05`, infra/02-env-ci-and-probes.md#environment-variable-catalog).
 * Parsed once at startup by `main.ts`; nothing else reads `process.env`.
 */

const booleanFlag = (defaultValue: boolean) =>
  z
    .enum(["true", "false", "1", "0", "yes", "no"], {
      errorMap: () => ({ message: "Expected one of true, false, 1, 0, yes, no" }),
    })
    .default(defaultValue ? "true" : "false")
    .transform((v) => v === "true" || v === "1" || v === "yes");

const httpUrl = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//.test(v), { message: "Must be an http(s) URL" })
  .transform((v) => v.replace(/\/+$/, ""));

const corsOrigins = z
  .string()
  .min(1)
  .transform((v, ctx) => {
    const origins = v
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter((o) => o.length > 0);
    for (const origin of origins) {
      if (origin === "*" || !/^https?:\/\/[^/\s]+$/.test(origin)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid origin: ${origin}` });
      }
    }
    if (origins.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one origin is required" });
    }
    return origins;
  });

const postgresUrl = z
  .string()
  .min(1)
  .refine((v) => /^postgres(ql)?:\/\//.test(v), { message: "Must be a postgres:// URL" });

export const EnvSchema = z.object({
  PUBLIC_URL: httpUrl,
  PUBLIC_API_URL: httpUrl,
  CORS_ORIGIN: corsOrigins,
  DATABASE_URL: postgresUrl,
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MEDIA_DIR: z.string().min(1).default("/data/media"),
  MIGRATE_ON_START: booleanFlag(true),
  JOBS_ENABLED: booleanFlag(true),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RESPONSE_VALIDATION: z.enum(["off", "strict"]).default("off"),
  GIT_SHA: z.string().min(1).default("dev"),
});

export type Env = z.infer<typeof EnvSchema>;

export type EnvParseResult = { ok: true; env: Env } | { ok: false; errors: string[] };

/** Pure parser; empty strings count as "unset" so compose `${VAR:-}` blanks fall back to defaults. */
export function parseEnv(source: Record<string, string | undefined>): EnvParseResult {
  const cleaned: Record<string, string> = {};
  for (const key of Object.keys(EnvSchema.shape)) {
    const value = source[key];
    if (value !== undefined && value.trim() !== "") cleaned[key] = value.trim();
  }
  const result = EnvSchema.safeParse(cleaned);
  if (result.success) return { ok: true, env: result.data };
  const errors = result.error.issues.map((issue) => {
    const key = issue.path.join(".") || "(root)";
    return `${key}: ${issue.message}`;
  });
  return { ok: false, errors };
}

/**
 * Parses `process.env`; on failure prints every invalid key (never the values) to stderr and
 * exits non-zero, which makes the container unhealthy (`F-INFRA-05`).
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = parseEnv(source);
  if (result.ok) return result.env;
  process.stderr.write(
    `Invalid environment configuration:\n${result.errors.map((e) => `  - ${e}`).join("\n")}\n`,
  );
  process.exit(1);
}
