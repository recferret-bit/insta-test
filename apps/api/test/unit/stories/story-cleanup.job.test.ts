import { describe, expect, it } from "vitest";

import type { StoryId } from "../../../src/domain/shared/ids.js";
import { CLEANUP_BATCH_SIZE, CLEANUP_INTERVAL_MS } from "../../../src/jobs/scheduled-job.js";
import { createStoryCleanupJob } from "../../../src/jobs/story-cleanup.job.js";
import { FakeClock } from "../../helpers/clock.js";
import { FakeMedia } from "../identity/fakes.js";
import { FakeStorage } from "../media/fakes.js";
import { FakeStories } from "./fakes.js";

function deleted(i: number) {
  const id = `0190b000-0000-7000-8000-${String(i).padStart(12, "0")}` as StoryId;
  return { storyId: id, storageKey: `2026/11/${id}.jpg` };
}

function setup() {
  const stories = new FakeStories(new FakeMedia());
  const storage = new FakeStorage();
  const clock = new FakeClock("2026-11-18T12:00:00.000Z");
  return { stories, storage, job: createStoryCleanupJob({ stories, storage, clock }) };
}

describe("StoryCleanupJob (F-BE-09)", () => {
  it("is named for its advisory lock (hashtext('story-cleanup')) and runs every 10 minutes", () => {
    const { job } = setup();
    expect(job.name).toBe("story-cleanup");
    expect(job.intervalMs).toBe(CLEANUP_INTERVAL_MS);
  });

  it("nothing expired → deleted 0, one query with cutoff = now and batch size 500", async () => {
    const { job, stories } = setup();
    expect(await job.run()).toEqual({ deleted: 0 });
    expect(stories.expiredCalls).toEqual([
      { cutoff: new Date("2026-11-18T12:00:00.000Z"), limit: CLEANUP_BATCH_SIZE },
    ]);
  });

  it("drains full batches until a short one and removes every deleted story's file", async () => {
    const { job, stories, storage } = setup();
    const full = Array.from({ length: CLEANUP_BATCH_SIZE }, (_, i) => deleted(i));
    const tail = [deleted(9001)];
    stories.expiredBatches = [full, tail];
    expect(await job.run()).toEqual({ deleted: CLEANUP_BATCH_SIZE + 1 });
    expect(stories.expiredCalls).toHaveLength(2);
    expect(storage.removed).toHaveLength(CLEANUP_BATCH_SIZE + 1);
    expect(storage.removed).toContain(tail[0]!.storageKey);
  });

  it("exactly one full batch → one extra (empty) query, then stop", async () => {
    const { job, stories } = setup();
    stories.expiredBatches = [Array.from({ length: CLEANUP_BATCH_SIZE }, (_, i) => deleted(i))];
    expect(await job.run()).toEqual({ deleted: CLEANUP_BATCH_SIZE });
    expect(stories.expiredCalls).toHaveLength(2);
  });

  it("a failed file removal does not stop the others; the tick then fails for the runner to log", async () => {
    const { job, stories, storage } = setup();
    const batch = [deleted(1), deleted(2), deleted(3)];
    stories.expiredBatches = [batch];
    storage.failRemove.add(batch[0]!.storageKey);
    await expect(job.run()).rejects.toThrow(/deleted 3 stories but failed to remove 1 files/);
    expect(storage.removed).toEqual(batch.map((b) => b.storageKey));
  });

  it("a repository failure propagates (retried next tick)", async () => {
    const { job, stories } = setup();
    stories.deleteExpiredBefore = async () => {
      throw new Error("db down");
    };
    await expect(job.run()).rejects.toThrow("db down");
  });
});
