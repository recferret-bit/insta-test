import type { MediaStorage } from "../domain/media/ports.js";
import type { Clock } from "../domain/shared/clock.js";
import type { StoryRepository } from "../domain/stories/ports.js";
import { CLEANUP_BATCH_SIZE, CLEANUP_INTERVAL_MS, type ScheduledJob } from "./scheduled-job.js";

export type StoryCleanupJobDeps = {
  stories: StoryRepository;
  storage: MediaStorage;
  clock: Clock;
};

/**
 * `StoryCleanupJob` (`F-BE-09`, backend/03-ports-and-handlers.md#scheduled-jobs). The runner holds
 * `pg_try_advisory_lock(hashtext('story-cleanup'))` around `run`, so only one replica cleans at a time.
 * Each tick hard-deletes stories with `expires_at < now` (story + media row + views, `DEC-14`) in batches
 * of `CLEANUP_BATCH_SIZE` until a short batch, removing each story's file. Expired stories are already
 * invisible to every read (`INV-06`), so cleanup lag never exposes them. File-removal failures do not stop
 * the tick; they are reported together afterwards so the runner logs the tick as failed.
 */
export function createStoryCleanupJob(deps: StoryCleanupJobDeps): ScheduledJob {
  return {
    name: "story-cleanup",
    intervalMs: CLEANUP_INTERVAL_MS,
    run: async () => {
      const cutoff = deps.clock.now();
      let deleted = 0;
      const failures: unknown[] = [];
      for (;;) {
        const batch = await deps.stories.deleteExpiredBefore(cutoff, CLEANUP_BATCH_SIZE);
        deleted += batch.length;
        const results = await Promise.allSettled(batch.map((s) => deps.storage.remove(s.storageKey)));
        for (const r of results) if (r.status === "rejected") failures.push(r.reason);
        if (batch.length < CLEANUP_BATCH_SIZE) break;
      }
      if (failures.length > 0) {
        throw new AggregateError(
          failures,
          `story-cleanup deleted ${deleted} stories but failed to remove ${failures.length} files`,
        );
      }
      return { deleted };
    },
  };
}
