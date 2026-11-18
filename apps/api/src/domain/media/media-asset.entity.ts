import type { MediaId, UserId } from "../shared/ids.js";

export const MEDIA_KINDS = ["image", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_PURPOSES = ["post", "story", "avatar"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const MEDIA_STATUSES = ["uploaded", "attached"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"] as const;
export type MediaMimeType = (typeof MEDIA_MIME_TYPES)[number];

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
