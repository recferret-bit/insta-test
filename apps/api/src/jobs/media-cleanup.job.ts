import type { MediaRepository, MediaStorage } from "../domain/media/ports.js";
import type { Clock } from "../domain/shared/clock.js";
import { CLEANUP_INTERVAL_MS, type ScheduledJob } from "./scheduled-job.js";

export type MediaCleanupJobDeps = {
  media: MediaRepository;
  storage: MediaStorage;
  clock: Clock;
};

/**
 * `MediaCleanupJob` — w00 stub (no-op), implemented by w01: delete `media_assets` with
 * `status = 'uploaded'` older than 24 h in batches of `CLEANUP_BATCH_SIZE`, then remove their files.
 */
export function createMediaCleanupJob(deps: MediaCleanupJobDeps): ScheduledJob {
  return {
    name: "media-cleanup",
    intervalMs: CLEANUP_INTERVAL_MS,
    run: async () => ({ deleted: 0 }),
  };
}
