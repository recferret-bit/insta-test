import { describe, expect, it } from "vitest";

import {
  type CreateMediaAssetInput,
  MEDIA_EXTENSIONS,
  MediaAsset,
  buildStorageKey,
  maxBytesFor,
  mediaKindOf,
} from "../../../src/domain/media/media-asset.entity.js";
import { DomainError, type ErrorCode } from "../../../src/domain/shared/errors.js";
import type { MediaId, UserId } from "../../../src/domain/shared/ids.js";
import { DOMAIN_LIMITS } from "../../../src/domain/shared/limits.js";

const now = new Date("2026-03-05T10:00:00.000Z");
const ownerId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01" as UserId;
const otherId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a02" as UserId;
const id = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a03" as MediaId;

const image: CreateMediaAssetInput = {
  id,
  ownerId,
  purpose: "post",
  mimeType: "image/png",
  storageKey: "2026/03/0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a03.png",
  byteSize: 1024,
  width: 1080,
  height: 1350,
  durationMs: null,
  now,
};
const video: CreateMediaAssetInput = {
  ...image,
  mimeType: "video/mp4",
  width: null,
  height: null,
  durationMs: 5000,
};

function expectCode(fn: () => unknown, code: ErrorCode): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

describe("media helpers", () => {
  it("derives kind and size limit from the MIME type", () => {
    expect(mediaKindOf("image/jpeg")).toBe("image");
    expect(mediaKindOf("image/webp")).toBe("image");
    expect(mediaKindOf("video/webm")).toBe("video");
    expect(maxBytesFor("image")).toBe(10 * 1024 * 1024);
    expect(maxBytesFor("video")).toBe(50 * 1024 * 1024);
  });

  it("builds <yyyy>/<mm>/<uuid>.<ext> keys that match the serving pattern", () => {
    expect(buildStorageKey(id, "image/jpeg", now)).toBe(`2026/03/${id}.jpg`);
    expect(buildStorageKey(id, "video/webm", new Date("2026-12-31T23:59:59.999Z"))).toBe(
      `2026/12/${id}.webm`,
    );
    const pattern = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$/;
    for (const mime of Object.keys(MEDIA_EXTENSIONS) as (keyof typeof MEDIA_EXTENSIONS)[]) {
      expect(buildStorageKey(id, mime, now)).toMatch(pattern);
    }
  });
});

describe("MediaAsset.create", () => {
  it("creates an uploaded image with kind derived from the MIME type", () => {
    expect(MediaAsset.create(image)).toEqual({
      id,
      ownerId,
      purpose: "post",
      kind: "image",
      mimeType: "image/png",
      storageKey: image.storageKey,
      byteSize: 1024,
      width: 1080,
      height: 1350,
      durationMs: null,
      status: "uploaded",
      createdAt: now,
    });
  });

  it("accepts boundary values", () => {
    expect(MediaAsset.create({ ...video, durationMs: 1 }).kind).toBe("video");
    expect(MediaAsset.create({ ...video, durationMs: DOMAIN_LIMITS.videoDurationMsMax }).durationMs).toBe(
      60_000,
    );
    expect(MediaAsset.create({ ...video, byteSize: DOMAIN_LIMITS.videoBytesMax }).byteSize).toBe(
      50 * 1024 * 1024,
    );
    expect(
      MediaAsset.create({ ...image, byteSize: DOMAIN_LIMITS.imageBytesMax, width: 1, height: 8192 }).height,
    ).toBe(8192);
    expect(MediaAsset.create({ ...image, purpose: "avatar" }).purpose).toBe("avatar");
  });

  it.each<[string, Partial<CreateMediaAssetInput>]>([
    ["avatar video", { ...video, purpose: "avatar" }],
    ["video without duration", { ...video, durationMs: null }],
    ["video duration 0", { ...video, durationMs: 0 }],
    ["video duration > 60 s", { ...video, durationMs: 60_001 }],
    ["fractional duration", { ...video, durationMs: 1.5 }],
    ["image with duration", { durationMs: 1000 }],
    ["width 0", { width: 0 }],
    ["height > 8192", { height: 8193 }],
    ["empty file", { byteSize: 0 }],
  ])("rejects %s with VALIDATION_FAILED", (_label, override) => {
    expectCode(() => MediaAsset.create({ ...image, ...override }), "VALIDATION_FAILED");
  });

  it("rejects oversize files with PAYLOAD_TOO_LARGE", () => {
    expectCode(
      () => MediaAsset.create({ ...image, byteSize: DOMAIN_LIMITS.imageBytesMax + 1 }),
      "PAYLOAD_TOO_LARGE",
    );
    expectCode(
      () => MediaAsset.create({ ...video, byteSize: DOMAIN_LIMITS.videoBytesMax + 1 }),
      "PAYLOAD_TOO_LARGE",
    );
  });
});

describe("MediaAsset.assertAttachable / attach", () => {
  const asset = MediaAsset.create(image);

  it("passes for the owner, matching purpose and uploaded status", () => {
    expect(() => MediaAsset.assertAttachable(asset, { ownerId, purpose: "post" })).not.toThrow();
    expect(() =>
      MediaAsset.assertAttachable(asset, { ownerId, purpose: "post", kind: "image" }),
    ).not.toThrow();
  });

  it.each<[string, Parameters<typeof MediaAsset.assertAttachable>]>([
    ["other owner", [asset, { ownerId: otherId, purpose: "post" }]],
    ["wrong purpose", [asset, { ownerId, purpose: "story" }]],
    ["wrong kind", [asset, { ownerId, purpose: "post", kind: "video" }]],
    [
      "already attached",
      [
        { ...asset, status: "attached" },
        { ownerId, purpose: "post" },
      ],
    ],
    // Avatars always require an image, even when `kind` is omitted.
    [
      "avatar video",
      [
        { ...asset, purpose: "avatar", kind: "video", mimeType: "video/mp4" },
        { ownerId, purpose: "avatar" },
      ],
    ],
  ])("throws MEDIA_INVALID for %s", (_label, args) => {
    expectCode(() => MediaAsset.assertAttachable(...args), "MEDIA_INVALID");
  });

  it("attach() moves uploaded → attached without mutating the input; attaching twice fails", () => {
    const attached = MediaAsset.attach(asset);
    expect(attached).toEqual({ ...asset, status: "attached" });
    expect(asset.status).toBe("uploaded");
    expectCode(() => MediaAsset.attach(attached), "MEDIA_INVALID");
  });
});
