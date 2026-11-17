import { createMediaCleanupJob, type MediaCleanupJobDeps } from "./media-cleanup.job.js";
import type { ScheduledJob } from "./scheduled-job.js";
import { createStoryCleanupJob, type StoryCleanupJobDeps } from "./story-cleanup.job.js";

export { runJobOnce, startJobs, type JobOutcome, type JobRunner } from "./runner.js";
export type { JobLogger, ScheduledJob } from "./scheduled-job.js";

export type JobDeps = MediaCleanupJobDeps & StoryCleanupJobDeps;

/** Every scheduled job (auto-discovery list); adding a job = new file + one entry here. */
export function createJobs(deps: JobDeps): ScheduledJob[] {
  return [createMediaCleanupJob(deps), createStoryCleanupJob(deps)];
}
