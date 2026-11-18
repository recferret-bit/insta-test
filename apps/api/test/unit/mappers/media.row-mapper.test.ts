import { describe, expect, it } from "vitest";

import { mapMediaEntityToRow, mapMediaRowToEntity } from "../../../src/data/mappers/media.row-mapper.js";
import type { MediaAssetRow } from "../../../src/data/rows/media.row.js";
import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import type { MediaId, UserId } from "../../../src/domain/shared/ids.js";

const image: MediaAsset = {
  id: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a03" as MediaId,
  ownerId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01" as UserId,
  purpose: "avatar",
  kind: "image",
  mimeType: "image/jpeg",
  storageKey: "2026/11/0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a03.jpg",
  byteSize: 204_800,
  width: 640,
  height: 640,
  durationMs: null,
  status: "uploaded",
  createdAt: new Date("2026-11-18T10:00:00.000Z"),
};
const video: MediaAsset = {
  ...image,
  purpose: "story",
  kind: "video",
  mimeType: "video/webm",
  storageKey: "2026/11/0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a03.webm",
  byteSize: 50 * 1024 * 1024,
  width: null,
  height: null,
  durationMs: 60_000,
  status: "attached",
};

describe("media row mapper", () => {
  it.each([
    ["image", image],
    ["video", video],
  ])("round-trips %s entity → row → entity", (_label, asset) => {
    expect(mapMediaRowToEntity(mapMediaEntityToRow(asset))).toEqual(asset);
  });

  it("serializes byte_size as the bigint string pg returns", () => {
    const row = mapMediaEntityToRow(image);
    expect(row).toEqual<MediaAssetRow>({
      id: image.id,
      owner_id: image.ownerId,
      purpose: "avatar",
      kind: "image",
      mime_type: "image/jpeg",
      storage_key: image.storageKey,
      byte_size: "204800",
      width: 640,
      height: 640,
      duration_ms: null,
      status: "uploaded",
      created_at: image.createdAt,
    });
  });

  it("parses a pg bigint string into a number", () => {
    const row: MediaAssetRow = { ...mapMediaEntityToRow(video), byte_size: "52428800" };
    expect(mapMediaRowToEntity(row).byteSize).toBe(52_428_800);
  });
});
