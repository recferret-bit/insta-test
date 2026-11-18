import type pg from "pg";

export type DbReadiness = { db: "ok" | "down"; migrationVersion: number | null };

/**
 * Readiness probe for `GET /api/v1/health` (infra/02-env-ci-and-probes.md#health-probes):
 * `SELECT 1`-equivalent round trip within `timeoutMs` and the latest on-disk migration applied.
 */
export function createDbReadinessCheck(
  pool: pg.Pool,
  expectedVersion: number | null,
  timeoutMs = 1_000,
): () => Promise<DbReadiness> {
  return async () => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("db readiness timeout")), timeoutMs);
    });
    try {
      const { rows } = await Promise.race([
        pool.query<{ version: number | null }>("SELECT max(version) AS version FROM schema_migrations"),
        timeout,
      ]);
      const version = rows[0]?.version ?? null;
      const migrated = expectedVersion === null || (version !== null && version >= expectedVersion);
      return { db: migrated ? "ok" : "down", migrationVersion: version };
    } catch {
      return { db: "down", migrationVersion: null };
    } finally {
      clearTimeout(timer);
    }
  };
}
