import { describe, expect, it, vi } from "vitest";

import { createJobs, runJobOnce, startJobs, type ScheduledJob } from "../../../src/jobs/index.js";
import { FakeClient, fakePool } from "../data/fake-pg.js";

const logger = () => ({ info: vi.fn(), error: vi.fn() });

function lockingClient(locked: boolean): FakeClient {
  const client = new FakeClient();
  client.rowsFor = (sql) => (sql.includes("pg_try_advisory_lock") ? [{ locked }] : []);
  return client;
}

const job = (run: ScheduledJob["run"]): ScheduledJob => ({ name: "test-job", intervalMs: 60_000, run });

describe("runJobOnce", () => {
  it("runs under the advisory lock, unlocks and logs { job, deleted, durationMs }", async () => {
    const client = lockingClient(true);
    const log = logger();
    const outcome = await runJobOnce(
      job(async () => ({ deleted: 3 })),
      fakePool(client),
      log,
    );
    expect(outcome).toBe("ran");
    expect(client.queries[0]).toContain("pg_try_advisory_lock");
    expect(client.queries.at(-1)).toContain("pg_advisory_unlock");
    expect(client.released).toBe(true);
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ job: "test-job", deleted: 3, durationMs: expect.any(Number) }),
      "job finished",
    );
  });

  it("skips when another replica holds the lock", async () => {
    const client = lockingClient(false);
    const run = vi.fn();
    expect(await runJobOnce(job(run), fakePool(client), logger())).toBe("skipped");
    expect(run).not.toHaveBeenCalled();
    expect(client.queries.some((q) => q.includes("unlock"))).toBe(false);
    expect(client.released).toBe(true);
  });

  it("logs failures and still unlocks", async () => {
    const client = lockingClient(true);
    const log = logger();
    const outcome = await runJobOnce(
      job(async () => Promise.reject(new Error("db down"))),
      fakePool(client),
      log,
    );
    expect(outcome).toBe("failed");
    expect(log.error).toHaveBeenCalled();
    expect(client.queries.at(-1)).toContain("pg_advisory_unlock");
  });
});

describe("startJobs", () => {
  it("does nothing when JOBS_ENABLED=false", async () => {
    const run = vi.fn();
    const runner = startJobs([job(run)], {
      pool: fakePool(lockingClient(true)),
      logger: logger(),
      enabled: false,
    });
    await new Promise((r) => setTimeout(r, 10));
    await runner.stop();
    expect(run).not.toHaveBeenCalled();
  });

  it("ticks immediately, then stops cleanly", async () => {
    const run = vi.fn(async () => ({ deleted: 0 }));
    const runner = startJobs([job(run)], {
      pool: fakePool(lockingClient(true)),
      logger: logger(),
      enabled: true,
    });
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await runner.stop();
  });
});

describe("createJobs", () => {
  it("registers media-cleanup and story-cleanup every 10 minutes", () => {
    const jobs = createJobs({} as Parameters<typeof createJobs>[0]);
    expect(jobs.map((j) => [j.name, j.intervalMs])).toEqual([
      ["media-cleanup", 600_000],
      ["story-cleanup", 600_000],
    ]);
  });
});
