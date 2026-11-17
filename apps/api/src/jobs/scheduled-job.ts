/** Auto-discovered in-process job (specs/01-project-structure.md#auto-discovery-extension-points). */
export type ScheduledJob = {
  /** Also the advisory-lock key: `pg_try_advisory_lock(hashtext(name))`. */
  name: string;
  intervalMs: number;
  /** One tick; returns how many rows/files were cleaned up. */
  run(): Promise<{ deleted: number }>;
};

/** pino-compatible logger surface. */
export type JobLogger = {
  info(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
};

export const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
export const CLEANUP_BATCH_SIZE = 500;
