import { Readable } from "node:stream";

import { MediaResponseDto, UploadMediaFields } from "@insta/contracts";
import { describe, expect, it } from "vitest";

import {
  mapMediaToResponseDto,
  mapUploadMultipartToCommand,
} from "../../../src/api/mappers/media.dto-mapper.js";
import { createUrlBuilder } from "../../../src/api/url-builder.js";
import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import type { MediaId, UserId } from "../../../src/domain/shared/ids.js";

const OWNER = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as UserId;
const ID = "0190a1b2-c3d4-7e5f-8a9b-aaaaaaaaaaaa" as MediaId;
const urls = createUrlBuilder("https://api.example.com/");

const asset: MediaAsset = {
  id: ID,
  ownerId: OWNER,
  purpose: "story",
  kind: "video",
  mimeType: "video/mp4",
  storageKey: `2026/11/${ID}.mp4`,
  byteSize: 123_456,
  width: 720,
  height: 1280,
  durationMs: 15_000,
  status: "uploaded",
  createdAt: new Date("2026-11-18T09:00:00.000Z"),
};

describe("mapMediaToResponseDto", () => {
  it("maps every field to the wire contract and builds the public URL", () => {
    const dto = mapMediaToResponseDto(asset, urls);
    expect(dto).toEqual({
      id: "med_0190a1b2c3d47e5f8a9baaaaaaaaaaaa",
      kind: "video",
      purpose: "story",
      mime_type: "video/mp4",
      url: `https://api.example.com/media/2026/11/${ID}.mp4`,
      width: 720,
      height: 1280,
      duration_ms: 15_000,
      size_bytes: 123_456,
      created_at: "2026-11-18T09:00:00.000Z",
    });
    expect(MediaResponseDto.parse(dto)).toEqual(dto);
  });

  it("keeps null dimensions/duration (image without duration, video without dims)", () => {
    const dto = mapMediaToResponseDto({ ...asset, width: null, height: null, durationMs: null }, urls);
    expect([dto.width, dto.height, dto.duration_ms]).toEqual([null, null, null]);
    expect(dto).not.toHaveProperty("status");
    expect(dto).not.toHaveProperty("owner_id");
  });
});

describe("mapUploadMultipartToCommand", () => {
  const stream = Readable.from([]);

  it("coerced text parts → command (declared dims, duration)", () => {
    const fields = UploadMediaFields.parse({
      purpose: "post",
      width: "720",
      height: "1280",
      duration_ms: "3000",
    });
    expect(mapUploadMultipartToCommand(fields, stream, OWNER)).toEqual({
      ownerId: OWNER,
      purpose: "post",
      stream,
      declaredWidth: 720,
      declaredHeight: 1280,
      durationMs: 3000,
    });
  });

  it("omits absent optional parts", () => {
    const cmd = mapUploadMultipartToCommand(UploadMediaFields.parse({ purpose: "avatar" }), stream, OWNER);
    expect(cmd).toEqual({ ownerId: OWNER, purpose: "avatar", stream });
  });

  it.each([
    [{}],
    [{ purpose: "banner" }],
    [{ purpose: "post", duration_ms: "60001" }],
    [{ purpose: "post", width: "0" }],
    [{ purpose: "post", height: "abc" }],
    [{ purpose: "post", extra: "x" }],
  ])("contract rejects %j", (raw) => {
    expect(UploadMediaFields.safeParse(raw).success).toBe(false);
  });
});
