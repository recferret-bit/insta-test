import { DomainError } from "../shared/errors.js";
import type { MediaId, UserId } from "../shared/ids.js";
import { DOMAIN_LIMITS } from "../shared/limits.js";

export const MEDIA_KINDS = ["image", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_PURPOSES = ["post", "story", "avatar"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const MEDIA_STATUSES = ["uploaded", "attached"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"] as const;
export type MediaMimeType = (typeof MEDIA_MIME_TYPES)[number];

/** File extension per MIME type; matches the `GET /media/*` key pattern `(jpg|png|webp|mp4|webm)`. */
export const MEDIA_EXTENSIONS: Readonly<Record<MediaMimeType, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export type MediaAsset = {
  id: MediaId;
  ownerId: UserId;
  purpose: MediaPurpose;
  kind: MediaKind;
  mimeType: MediaMimeType;
  /** `<yyyy>/<mm>/<uuid>.<ext>` */
  storageKey: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  status: MediaStatus;
  createdAt: Date;
};

/** Expectations checked by `assertAttachable` (avatar → image). */
export type AttachRequirement = { ownerId: UserId; purpose: MediaPurpose; kind?: MediaKind };

export type CreateMediaAssetInput = {
  id: MediaId;
  ownerId: UserId;
  purpose: MediaPurpose;
  /** Sniffed from magic bytes, never the client `Content-Type`. */
  mimeType: MediaMimeType;
  storageKey: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  now: Date;
};

function invalid(path: string, message: string): never {
  throw new DomainError("VALIDATION_FAILED", message, [{ path, message }]);
}

function mediaInvalid(message: string): never {
  throw new DomainError("MEDIA_INVALID", message);
}

function isIntInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function mediaKindOf(mimeType: MediaMimeType): MediaKind {
  return mimeType.startsWith("video/") ? "video" : "image";
}

export function maxBytesFor(kind: MediaKind): number {
  return kind === "video" ? DOMAIN_LIMITS.videoBytesMax : DOMAIN_LIMITS.imageBytesMax;
}

/** `<yyyy>/<mm>/<uuid>.<ext>` using the UTC year/month of `now`. */
export function buildStorageKey(id: MediaId, mimeType: MediaMimeType, now: Date): string {
  const yyyy = String(now.getUTCFullYear()).padStart(4, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}/${mm}/${id}.${MEDIA_EXTENSIONS[mimeType]}`;
}

/** Entity factories & state rules for `ENT-Media` (`uploaded → attached`, `INV-03`, `INV-04`). */
export const MediaAsset = {
  /**
   * New `uploaded` asset. `VALIDATION_FAILED`: avatar video, video without `durationMs` (1–60000), image with a
   * duration, dimensions outside 1–8192, non-positive size. `PAYLOAD_TOO_LARGE`: size over the kind's limit.
   */
  create(input: CreateMediaAssetInput): MediaAsset {
    const kind = mediaKindOf(input.mimeType);
    if (input.purpose === "avatar" && kind !== "image") invalid("file", "Avatar must be an image");
    if (!Number.isInteger(input.byteSize) || input.byteSize <= 0) invalid("file", "File is empty");
    if (input.byteSize > maxBytesFor(kind)) {
      throw new DomainError("PAYLOAD_TOO_LARGE", `File exceeds the ${kind} size limit`);
    }
    for (const [path, value] of [
      ["width", input.width],
      ["height", input.height],
    ] as const) {
      if (value !== null && !isIntInRange(value, 1, DOMAIN_LIMITS.mediaDimensionMax)) {
        invalid(path, `Must be an integer between 1 and ${DOMAIN_LIMITS.mediaDimensionMax}`);
      }
    }
    if (kind === "video") {
      if (input.durationMs === null) invalid("duration_ms", "duration_ms is required for videos");
      if (!isIntInRange(input.durationMs, 1, DOMAIN_LIMITS.videoDurationMsMax)) {
        invalid("duration_ms", `Must be an integer between 1 and ${DOMAIN_LIMITS.videoDurationMsMax}`);
      }
    } else if (input.durationMs !== null) {
      invalid("duration_ms", "duration_ms is only allowed for videos");
    }
    return {
      id: input.id,
      ownerId: input.ownerId,
      purpose: input.purpose,
      kind,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      byteSize: input.byteSize,
      width: input.width,
      height: input.height,
      durationMs: input.durationMs,
      status: "uploaded",
      createdAt: input.now,
    };
  },

  /**
   * `MEDIA_INVALID` unless the owner matches, the purpose matches, the asset is still `uploaded`, and the kind
   * matches (`kind` when given; avatars always require `image`).
   */
  assertAttachable(asset: MediaAsset, req: AttachRequirement): void {
    if (asset.ownerId !== req.ownerId) mediaInvalid("Media belongs to another user");
    if (asset.purpose !== req.purpose)
      mediaInvalid(`Media was uploaded for '${asset.purpose}', not '${req.purpose}'`);
    if (asset.status !== "uploaded") mediaInvalid("Media is already attached");
    const kind = req.kind ?? (req.purpose === "avatar" ? "image" : undefined);
    if (kind !== undefined && asset.kind !== kind) mediaInvalid(`Media must be a ${kind}`);
  },

  /** `uploaded → attached`; attaching an attached asset again → `MEDIA_INVALID`. */
  attach(asset: MediaAsset): MediaAsset {
    if (asset.status !== "uploaded") mediaInvalid("Media is already attached");
    return { ...asset, status: "attached" };
  },
};
