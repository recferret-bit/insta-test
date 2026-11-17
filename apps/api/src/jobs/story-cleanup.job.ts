import type { MediaStorage } from "../domain/media/ports.js";
import type { Clock } from "../domain/shared/clock.js";
import type { StoryRepository } from "../domain/stories/ports.js";
import { CLEANUP_INTERVAL_MS, type ScheduledJob } from "./scheduled-job.js";

export type StoryCleanupJobDeps = {
  stories: StoryRepository;
  storage: MediaStorage;
  clock: Clock;
};

/**
 * `StoryCleanupJob` — w00 stub (no-op), implemented by w04: delete stories with `expires_at < now()`
 * in batches of `CLEANUP_BATCH_SIZE` (`StoryRepository.deleteExpiredBefore`), then remove their files.
 */
export function createStoryCleanupJob(deps: StoryCleanupJobDeps): ScheduledJob {
  return {
    name: "story-cleanup",
    intervalMs: CLEANUP_INTERVAL_MS,
    run: async () => ({ deleted: 0 }),
  };
}
