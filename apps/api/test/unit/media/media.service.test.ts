import { Readable } from "node:stream";

import { beforeEach, describe, expect, it } from "vitest";

import type { UploadMediaCommand } from "../../../src/domain/media/commands.js";
import { MediaService, SNIFF_HEAD_BYTES } from "../../../src/domain/media/media.service.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import type { UserId } from "../../../src/domain/shared/ids.js";
import { DOMAIN_LIMITS } from "../../../src/domain/shared/limits.js";
import { FakeClock } from "../../helpers/clock.js";
import {
  FakeMediaRepo,
  FakeProbe,
  FakeStorage,
  fileStream,
  JPEG_HEAD,
  MP4_HEAD,
  PNG_HEAD,
  WEBM_HEAD,
} from "./fakes.js";

const OWNER = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as UserId;
const MEDIA_UUID = "0190a1b2-c3d4-7e5f-8a9b-aaaaaaaaaaaa";

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof DomainError) return err.code;
    throw err;
  }
  throw new Error("expected a DomainError");
}

describe("MediaService.upload (F-BE-02)", () => {
  let repo: FakeMediaRepo;
  let storage: FakeStorage;
  let probe: FakeProbe;
  let service: MediaService;

  beforeEach(() => {
    repo = new FakeMediaRepo();
    storage = new FakeStorage();
    probe = new FakeProbe();
    service = new MediaService({
      media: repo,
      storage,
      probe,
      clock: new FakeClock("2026-03-05T10:00:00.000Z"),
      ids: { uuidv7: () => MEDIA_UUID },
    });
  });

  const cmd = (stream: Readable, extra: Partial<UploadMediaCommand> = {}): UploadMediaCommand => ({
    ownerId: OWNER,
    purpose: "post",
    stream,
    ...extra,
  });

  it("stores a JPEG under <yyyy>/<mm>/<uuid>.jpg with probed dimensions and inserts an uploaded row", async () => {
    const asset = await service.upload(cmd(fileStream(JPEG_HEAD, 200_000)));
    expect(asset).toMatchObject({
      id: MEDIA_UUID,
      ownerId: OWNER,
      purpose: "post",
      kind: "image",
      mimeType: "image/jpeg",
      storageKey: `2026/03/${MEDIA_UUID}.jpg`,
      byteSize: 200_000,
      width: 640,
      height: 480,
      durationMs: null,
      status: "uploaded",
    });
    expect(asset.createdAt.toISOString()).toBe("2026-03-05T10:00:00.000Z");
    expect(storage.files.get(asset.storageKey)?.length).toBe(200_000);
    expect(storage.lastMaxBytes).toBe(DOMAIN_LIMITS.imageBytesMax);
    expect(probe.probedPaths).toEqual([`/media-root/${asset.storageKey}`]);
    expect(repo.rows.get(asset.id)).toEqual(asset);
  });

  it("keeps every byte intact when the head arrives in tiny chunks (sniff spans chunks)", async () => {
    const stream = fileStream(PNG_HEAD, SNIFF_HEAD_BYTES * 3 + 7, 3);
    const expected = Buffer.alloc(SNIFF_HEAD_BYTES * 3 + 7, 0x2a);
    PNG_HEAD.copy(expected, 0);
    const asset = await service.upload(cmd(stream));
    expect(asset.mimeType).toBe("image/png");
    expect(storage.files.get(asset.storageKey)?.equals(expected)).toBe(true);
  });

  it("accepts a file smaller than the sniff window", async () => {
    const asset = await service.upload(cmd(fileStream(PNG_HEAD, 40)));
    expect(asset.byteSize).toBe(40);
  });

  it("ignores client-declared dimensions for images (probed server-side)", async () => {
    const asset = await service.upload(
      cmd(fileStream(JPEG_HEAD, 1000), { declaredWidth: 1, declaredHeight: 2 }),
    );
    expect([asset.width, asset.height]).toEqual([640, 480]);
  });

  it.each([
    ["mp4", MP4_HEAD, "video/mp4", "mp4"],
    ["webm", WEBM_HEAD, "video/webm", "webm"],
  ])(
    "stores a %s video with declared dims + duration and the video size limit",
    async (_l, head, mime, ext) => {
      const asset = await service.upload(
        cmd(fileStream(head, 5000), {
          purpose: "story",
          durationMs: 15_000,
          declaredWidth: 720,
          declaredHeight: 1280,
        }),
      );
      expect(asset).toMatchObject({
        kind: "video",
        mimeType: mime,
        purpose: "story",
        width: 720,
        height: 1280,
        durationMs: 15_000,
        storageKey: `2026/03/${MEDIA_UUID}.${ext}`,
      });
      expect(storage.lastMaxBytes).toBe(DOMAIN_LIMITS.videoBytesMax);
      expect(probe.probedPaths).toEqual([]);
    },
  );

  it("video dimensions are optional", async () => {
    const asset = await service.upload(cmd(fileStream(MP4_HEAD, 5000), { durationMs: 1 }));
    expect([asset.width, asset.height]).toEqual([null, null]);
  });

  it("unsupported type → UNSUPPORTED_MEDIA_TYPE, nothing stored (client Content-Type is irrelevant)", async () => {
    const gif = Buffer.from("GIF89a", "latin1");
    expect(await codeOf(service.upload(cmd(fileStream(gif, 10_000))))).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(storage.files.size).toBe(0);
    expect(repo.rows.size).toBe(0);
  });

  it("empty file → VALIDATION_FAILED", async () => {
    const err = await service.upload(cmd(Readable.from([], { objectMode: false }))).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "VALIDATION_FAILED", details: [{ path: "file" }] });
  });

  it("avatar video → VALIDATION_FAILED before anything is written", async () => {
    const err = await service
      .upload(cmd(fileStream(MP4_HEAD, 5000), { purpose: "avatar", durationMs: 1000 }))
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "VALIDATION_FAILED", details: [{ path: "file" }] });
    expect(storage.files.size).toBe(0);
  });

  it("video without duration_ms → VALIDATION_FAILED before anything is written", async () => {
    const err = await service.upload(cmd(fileStream(WEBM_HEAD, 5000))).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "VALIDATION_FAILED", details: [{ path: "duration_ms" }] });
    expect(storage.files.size).toBe(0);
  });

  it("image with duration_ms → VALIDATION_FAILED", async () => {
    const err = await service
      .upload(cmd(fileStream(JPEG_HEAD, 5000), { durationMs: 10 }))
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "VALIDATION_FAILED", details: [{ path: "duration_ms" }] });
    expect(storage.files.size).toBe(0);
  });

  it.each([0, 60_001])(
    "video duration %i ms out of bounds → VALIDATION_FAILED and file removed",
    async (ms) => {
      expect(await codeOf(service.upload(cmd(fileStream(MP4_HEAD, 5000), { durationMs: ms })))).toBe(
        "VALIDATION_FAILED",
      );
      expect(storage.files.size).toBe(0);
      expect(storage.removed).toHaveLength(1);
      expect(repo.rows.size).toBe(0);
    },
  );

  it("video declared width > 8192 → VALIDATION_FAILED and file removed", async () => {
    const p = service.upload(cmd(fileStream(MP4_HEAD, 5000), { durationMs: 10, declaredWidth: 8193 }));
    expect(await codeOf(p)).toBe("VALIDATION_FAILED");
    expect(storage.files.size).toBe(0);
  });

  it("probed image larger than 8192 px → VALIDATION_FAILED and file removed", async () => {
    probe.dims = { width: 8193, height: 10 };
    expect(await codeOf(service.upload(cmd(fileStream(JPEG_HEAD, 5000))))).toBe("VALIDATION_FAILED");
    expect(storage.files.size).toBe(0);
  });

  it("corrupt image header → UNSUPPORTED_MEDIA_TYPE and file removed", async () => {
    probe.dims = new DomainError("UNSUPPORTED_MEDIA_TYPE", "Could not read image dimensions");
    expect(await codeOf(service.upload(cmd(fileStream(PNG_HEAD, 5000))))).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(storage.files.size).toBe(0);
    expect(repo.rows.size).toBe(0);
  });

  it("image over 10 MiB → PAYLOAD_TOO_LARGE, nothing inserted", async () => {
    const p = service.upload(cmd(fileStream(JPEG_HEAD, DOMAIN_LIMITS.imageBytesMax + 1)));
    expect(await codeOf(p)).toBe("PAYLOAD_TOO_LARGE");
    expect(storage.files.size).toBe(0);
    expect(repo.rows.size).toBe(0);
  });

  it("image of exactly 10 MiB is accepted (boundary)", async () => {
    const asset = await service.upload(cmd(fileStream(JPEG_HEAD, DOMAIN_LIMITS.imageBytesMax)));
    expect(asset.byteSize).toBe(DOMAIN_LIMITS.imageBytesMax);
  });

  it("insert failure removes the stored file and rethrows the original error", async () => {
    const dbError = new Error("connection reset");
    repo.failInsert = dbError;
    await expect(service.upload(cmd(fileStream(JPEG_HEAD, 5000)))).rejects.toBe(dbError);
    expect(storage.removed).toEqual([`2026/03/${MEDIA_UUID}.jpg`]);
    expect(storage.files.size).toBe(0);
  });

  it("a failing cleanup does not mask the original error", async () => {
    const dbError = new Error("connection reset");
    repo.failInsert = dbError;
    storage.failRemove.add(`2026/03/${MEDIA_UUID}.jpg`);
    await expect(service.upload(cmd(fileStream(JPEG_HEAD, 5000)))).rejects.toBe(dbError);
  });

  it("propagates a source stream error", async () => {
    const stream = new Readable({
      read() {
        this.destroy(new Error("client aborted"));
      },
    });
    await expect(service.upload(cmd(stream))).rejects.toThrow("client aborted");
    expect(repo.rows.size).toBe(0);
  });
});
