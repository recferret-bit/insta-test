import type pg from "pg";

import { runMigrations } from "../../src/data/db/migrate.js";
import { createPool } from "../../src/data/db/pool.js";
import { testDatabaseUrl } from "./env.js";

let shared: pg.Pool | undefined;

/** One pool per test file (`TEST_DB_POOL_MAX`, default 5). Close it in `afterAll` with `closeTestPool`. */
export function getTestPool(): pg.Pool {
  shared ??= createPool(testDatabaseUrl(), {
    max: Number(process.env.TEST_DB_POOL_MAX ?? 5),
    applicationName: "insta-api-test",
  });
  return shared;
}

export async function closeTestPool(): Promise<void> {
  const pool = shared;
  shared = undefined;
  await pool?.end();
}

/**
 * Fresh schema: drops and recreates `public` (incl. `schema_migrations` and extensions), then
 * applies every migration from `apps/api/migrations`. Call in `beforeAll`/`beforeEach`.
 */
export async function resetDb(pool: pg.Pool = getTestPool()): Promise<void> {
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await runMigrations(pool);
}

/** Empties every application table but keeps the schema (cheaper than `resetDb` between tests). */
export async function truncateAll(pool: pg.Pool = getTestPool()): Promise<void> {
  await pool.query(
    `TRUNCATE notifications, story_views, stories, follows, post_likes, comments, post_hashtags,
              post_media, posts, sessions, media_assets, users RESTART IDENTITY CASCADE`,
  );
}
