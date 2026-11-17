import type { MediaId, UserId } from "./shared/ids.ts";

/** ENT-Media business entity (backend/01-business-entities.md#mediaasset). */

export type MediaKind = "image" | "video";
export type MediaPurpose = "post" | "story" | "avatar";
export type MediaStatus = "uploaded" | "attached";
export type MediaMimeType = "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm";

export const MEDIA_MIME_TO_KIND: Readonly<Record<MediaMimeType, MediaKind>> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/webm": "video",
};

/** File extension used in storage keys `<yyyy>/<mm>/<uuid>.<ext>`. */
export const MEDIA_MIME_TO_EXT: Readonly<Record<MediaMimeType, string>> = {
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
  storageKey: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null; // videos only, 1..60000
  status: MediaStatus;
  createdAt: Date;
};

export type UploadMediaCommand = {
  ownerId: UserId;
  purpose: MediaPurpose;
  stream: AsyncIterable<Uint8Array>;
  declaredWidth?: number;
  declaredHeight?: number;
  durationMs?: number;
};
