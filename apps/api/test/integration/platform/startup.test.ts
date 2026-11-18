import { afterAll, describe, expect, it, vi } from "vitest";

import { runJobOnce } from "../../../src/jobs/index.js";
import { buildTestApp, closeTestPool, getTestPool } from "../../helpers/index.js";

describe("startup & jobs against PostgreSQL", () => {
  const pool = getTestPool();

  afterAll(async () => {
    await closeTestPool();
  });

  it("health is 503 before migrations and 200 after MIGRATE_ON_START applies them", async () => {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");

    const unmigrated = await buildTestApp();
    try {
      const res = await unmigrated.app.inject({ url: "/api/v1/health" });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ status: "degraded", db: "down" });
    } finally {
      await unmigrated.close();
    }

    const migrated = await buildTestApp({ env: { MIGRATE_ON_START: "true" } });
    try {
      expect((await migrated.app.inject({ url: "/api/v1/health" })).statusCode).toBe(200);
    } finally {
      await migrated.close();
    }
  });

  it("runJobOnce holds a real advisory lock during the run and releases it afterwards", async () => {
    const countLocks = async (): Promise<number> => {
      const { rows } = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_locks
          WHERE locktype = 'advisory' AND objid::text::bigint = (hashtext($1)::bigint & 4294967295)`,
        ["it-job"],
      );
      return rows[0]?.n ?? -1;
    };
    let heldDuringRun = -1;
    const run = vi.fn(async () => {
      heldDuringRun = await countLocks();
      return { deleted: 0 };
    });
    const logger = { info: vi.fn(), error: vi.fn() };
    expect(await runJobOnce({ name: "it-job", intervalMs: 1000, run }, pool, logger)).toBe("ran");
    expect(heldDuringRun).toBe(1);
    expect(await countLocks()).toBe(0);
  });
});
