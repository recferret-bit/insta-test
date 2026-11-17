import pg from "pg";

export type PoolOptions = {
  /** Max pooled connections (default 10). */
  max?: number;
  /** Application name visible in `pg_stat_activity`. */
  applicationName?: string;
};

/**
 * Creates the process-wide `pg.Pool`. Type parsing follows persistence/03-row-mappers.md:
 * `timestamptz` → `Date`, `uuid` → `string`, `bigint` → `string`, `bytea` → `Buffer` (pg defaults).
 */
export function createPool(databaseUrl: string, options: PoolOptions = {}): pg.Pool {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: options.max ?? 10,
    application_name: options.applicationName ?? "insta-api",
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  // An idle client erroring (e.g. DB restart) must not crash the process; the next query reconnects.
  pool.on("error", () => undefined);
  return pool;
}
