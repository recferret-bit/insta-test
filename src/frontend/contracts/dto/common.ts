// Source: docs/specs/external-communication/01-api-conventions.md (Common DTOs).
import type { MediaId, UserId } from "../ids.ts";

export type UserSummaryDto = {
  id: UserId;
  username: string;
  full_name: string;
  avatar_url: string | null;
  /** null when anonymous or self. */
  is_following: boolean | null;
};

export type MediaKind = "image" | "video";
export type MediaPurpose = "post" | "story" | "avatar";

export type MediaResponseDto = {
  id: MediaId;
  kind: MediaKind;
  purpose: MediaPurpose;
  mime_type: string;
  url: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  size_bytes: number;
  created_at: string;
};

/** Non-file multipart fields of `POST /media` (UploadMediaRequest). */
export type UploadMediaFields = {
  purpose: MediaPurpose;
  /** Videos only, 1–8192. */
  width?: number;
  /** Videos only, 1–8192. */
  height?: number;
  /** Required for videos, 1–60000. */
  duration_ms?: number;
};
