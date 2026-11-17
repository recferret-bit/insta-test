import type pg from "pg";

import type { JobLogger, ScheduledJob } from "./scheduled-job.js";

export type JobOutcome = "ran" | "skipped" | "failed";

/**
 * Runs one tick under `pg_try_advisory_lock(hashtext(job.name))` so only one API replica
 * cleans at a time (backend/03-ports-and-handlers.md#scheduled-jobs). Logs `{ job, deleted, durationMs }`;
 * a failure is logged and retried on the next tick.
 */
export async function runJobOnce(job: ScheduledJob, pool: pg.Pool, logger: JobLogger): Promise<JobOutcome> {
  const started = Date.now();
  let client: pg.PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    logger.error({ job: job.name, err }, "job failed to acquire a connection");
    return "failed";
  }
  let locked = false;
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [job.name],
    );
    locked = rows[0]?.locked === true;
    if (!locked) return "skipped";
    const { deleted } = await job.run();
    logger.info({ job: job.name, deleted, durationMs: Date.now() - started }, "job finished");
    return "ran";
  } catch (err) {
    logger.error({ job: job.name, err, durationMs: Date.now() - started }, "job failed");
    return "failed";
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [job.name]).catch(() => undefined);
    }
    client.release();
  }
}

export interface JobRunner {
  /** Cancels future ticks and waits for running ones. */
  stop(): Promise<void>;
}

/**
 * Starts every job (first tick immediately, then every `intervalMs`, never overlapping itself).
 * Call after the HTTP server is listening. `enabled = false` (`JOBS_ENABLED=false`) starts nothing.
 */
export function startJobs(
  jobs: readonly ScheduledJob[],
  options: { pool: pg.Pool; logger: JobLogger; enabled: boolean },
): JobRunner {
  if (!options.enabled) return { stop: async () => undefined };

  let stopped = false;
  const timers = new Set<NodeJS.Timeout>();
  const running = new Set<Promise<unknown>>();

  const schedule = (job: ScheduledJob, delayMs: number): void => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (stopped) return;
      const tick = runJobOnce(job, options.pool, options.logger).finally(() => {
        running.delete(tick);
        if (!stopped) schedule(job, job.intervalMs);
      });
      running.add(tick);
    }, delayMs);
    timer.unref();
    timers.add(timer);
  };

  for (const job of jobs) schedule(job, 0);

  return {
    stop: async () => {
      stopped = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      await Promise.allSettled([...running]);
    },
  };
}
