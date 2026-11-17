import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseEnv, type Env } from "../../src/config/env.js";

/** Database used by integration tests (`TEST_DATABASE_URL`, else `DATABASE_URL`). It is wiped by `resetDb`. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Integration tests need TEST_DATABASE_URL or DATABASE_URL (a disposable PostgreSQL 16 database)",
    );
  }
  return url;
}

/** A valid `Env` for tests: strict response validation, silent logs, no jobs, no auto-migrate. */
export function testEnv(overrides: Record<string, string> = {}): Env {
  const result = parseEnv({
    PUBLIC_URL: "http://localhost:18000",
    PUBLIC_API_URL: "http://localhost:18001",
    CORS_ORIGIN: "http://localhost:18000",
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://unused@localhost/unused",
    MEDIA_DIR: mkdtempSync(path.join(tmpdir(), "insta-media-")),
    MIGRATE_ON_START: "false",
    JOBS_ENABLED: "false",
    LOG_LEVEL: "silent",
    RESPONSE_VALIDATION: "strict",
    GIT_SHA: "test",
    ...overrides,
  });
  if (!result.ok) throw new Error(`invalid test env: ${result.errors.join("; ")}`);
  return result.env;
}
