import type { MediaRepository, MediaStorage } from "../domain/media/ports.js";
import type { Clock } from "../domain/shared/clock.js";
import { CLEANUP_BATCH_SIZE, CLEANUP_INTERVAL_MS, type ScheduledJob } from "./scheduled-job.js";

export type MediaCleanupJobDeps = {
  media: MediaRepository;
  storage: MediaStorage;
  clock: Clock;
};

/** Unattached uploads older than this are purged (specs/03-domain-and-entity-map.md ENT-Media). */
export const UNATTACHED_MEDIA_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * `MediaCleanupJob` (`F-BE-09`, backend/03-ports-and-handlers.md#scheduled-jobs). The runner holds
 * `pg_try_advisory_lock(hashtext('media-cleanup'))` around `run`, so only one replica cleans at a time.
 * Each tick deletes `status = 'uploaded'` rows with `created_at < now - 24h` in batches of
 * `CLEANUP_BATCH_SIZE` until a short batch, removing each deleted row's file. File-removal failures do
 * not stop the tick; they are reported together afterwards so the runner logs the tick as failed.
 */
export function createMediaCleanupJob(deps: MediaCleanupJobDeps): ScheduledJob {
  return {
    name: "media-cleanup",
    intervalMs: CLEANUP_INTERVAL_MS,
    run: async () => {
      const cutoff = new Date(deps.clock.now().getTime() - UNATTACHED_MEDIA_TTL_MS);
      let deleted = 0;
      const failures: unknown[] = [];
      for (;;) {
        const batch = await deps.media.deleteUnattachedOlderThan(cutoff, CLEANUP_BATCH_SIZE);
        deleted += batch.length;
        const results = await Promise.allSettled(batch.map((m) => deps.storage.remove(m.storageKey)));
        for (const r of results) if (r.status === "rejected") failures.push(r.reason);
        if (batch.length < CLEANUP_BATCH_SIZE) break;
      }
      if (failures.length > 0) {
        throw new AggregateError(
          failures,
          `media-cleanup deleted ${deleted} rows but failed to remove ${failures.length} files`,
        );
      }
      return { deleted };
    },
  };
}
