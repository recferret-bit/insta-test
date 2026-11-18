import { describe, expect, it } from "vitest";

import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import type { MediaId, UserId } from "../../../src/domain/shared/ids.js";
import { createMediaCleanupJob, UNATTACHED_MEDIA_TTL_MS } from "../../../src/jobs/media-cleanup.job.js";
import { CLEANUP_BATCH_SIZE, CLEANUP_INTERVAL_MS } from "../../../src/jobs/scheduled-job.js";
import { FakeClock } from "../../helpers/clock.js";
import { FakeMediaRepo, FakeStorage } from "./fakes.js";

function asset(i: number): MediaAsset {
  const id = `0190a1b2-c3d4-7e5f-8a9b-${String(i).padStart(12, "0")}` as MediaId;
  return {
    id,
    ownerId: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as UserId,
    purpose: "post",
    kind: "image",
    mimeType: "image/jpeg",
    storageKey: `2026/11/${id}.jpg`,
    byteSize: 10,
    width: 1,
    height: 1,
    durationMs: null,
    status: "uploaded",
    createdAt: new Date("2026-11-16T00:00:00.000Z"),
  };
}

function setup() {
  const media = new FakeMediaRepo();
  const storage = new FakeStorage();
  const clock = new FakeClock("2026-11-18T12:00:00.000Z");
  return { media, storage, job: createMediaCleanupJob({ media, storage, clock }) };
}

describe("MediaCleanupJob (F-BE-09)", () => {
  it("is named for its advisory lock and runs every 10 minutes", () => {
    const { job } = setup();
    expect(job.name).toBe("media-cleanup");
    expect(job.intervalMs).toBe(CLEANUP_INTERVAL_MS);
  });

  it("nothing to clean → deleted 0, one query with cutoff now − 24h and batch size 500", async () => {
    const { job, media } = setup();
    expect(await job.run()).toEqual({ deleted: 0 });
    expect(media.deleteCalls).toEqual([
      {
        cutoff: new Date(Date.parse("2026-11-18T12:00:00.000Z") - UNATTACHED_MEDIA_TTL_MS),
        limit: CLEANUP_BATCH_SIZE,
      },
    ]);
  });

  it("drains full batches until a short one and removes every deleted file", async () => {
    const { job, media, storage } = setup();
    const full = Array.from({ length: CLEANUP_BATCH_SIZE }, (_, i) => asset(i));
    const tail = [asset(9001), asset(9002)];
    media.deleteBatches = [full, tail];
    expect(await job.run()).toEqual({ deleted: CLEANUP_BATCH_SIZE + 2 });
    expect(media.deleteCalls).toHaveLength(2);
    expect(storage.removed).toHaveLength(CLEANUP_BATCH_SIZE + 2);
    expect(storage.removed).toContain(tail[1]!.storageKey);
  });

  it("a failed file removal does not stop other removals; the tick then fails for the runner to log", async () => {
    const { job, media, storage } = setup();
    const batch = [asset(1), asset(2), asset(3)];
    media.deleteBatches = [batch];
    storage.failRemove.add(batch[1]!.storageKey);
    await expect(job.run()).rejects.toThrow(/deleted 3 rows but failed to remove 1 files/);
    expect(storage.removed).toEqual(batch.map((m) => m.storageKey));
  });

  it("a repository failure propagates (retried next tick)", async () => {
    const { job, media } = setup();
    media.deleteUnattachedOlderThan = async () => {
      throw new Error("db down");
    };
    await expect(job.run()).rejects.toThrow("db down");
  });
});
