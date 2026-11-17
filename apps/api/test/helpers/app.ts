import type { FastifyInstance } from "fastify";
import type pg from "pg";

import type { Env } from "../../src/config/env.js";
import type { Clock } from "../../src/domain/shared/clock.js";
import { createApp, type App } from "../../src/main.js";
import { FakeClock } from "./clock.js";
import { getTestPool } from "./db.js";
import { testEnv } from "./env.js";
import { testPasswordHasher } from "./factories.js";

export type TestApp = {
  /** Not listening; use `app.inject(...)`. Add test-only routes before the first `inject`. */
  app: FastifyInstance;
  pool: pg.Pool;
  services: App["services"];
  bus: App["bus"];
  clock: Clock;
  env: Env;
  close(): Promise<void>;
};

/**
 * Full composition root (`createApp` from `main.ts`) against the shared test pool:
 * real repositories/services, cheap argon2, `RESPONSE_VALIDATION=strict`, jobs off, no auto-migrate
 * (call `resetDb()` first). Pass `clock` to control expiry; `env` overrides individual variables.
 */
export async function buildTestApp(
  options: { clock?: Clock; env?: Record<string, string>; rateLimit?: boolean; pool?: pg.Pool } = {},
): Promise<TestApp> {
  const env = testEnv(options.env);
  const pool = options.pool ?? getTestPool();
  const clock = options.clock ?? new FakeClock(new Date());
  const built = await createApp(env, {
    pool,
    clock,
    passwordHasher: testPasswordHasher,
    rateLimit: options.rateLimit ?? true,
  });
  return {
    app: built.server,
    pool,
    services: built.services,
    bus: built.bus,
    clock,
    env,
    close: () => built.close(),
  };
}
