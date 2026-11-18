/** `MediaViewModel` & `toMediaVM` (frontend/02). Owned by w01 after w00. */
import type { MediaResponseDto } from "@insta/contracts";

/** Feed/post media frame is clamped between portrait 4:5 and landscape 1.91:1. */
export const ASPECT_RATIO_MIN = 4 / 5;
export const ASPECT_RATIO_MAX = 1.91;

export type MediaViewModel = {
  id: string;
  kind: "image" | "video";
  isVideo: boolean;
  purpose: "post" | "story" | "avatar";
  mimeType: string;
  url: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /** width / height clamped to [4:5, 1.91:1]; `1` when dimensions are unknown. */
  aspectRatio: number;
};

export function clampAspectRatio(width: number | null, height: number | null): number {
  if (!width || !height || width <= 0 || height <= 0) return 1;
  return Math.min(ASPECT_RATIO_MAX, Math.max(ASPECT_RATIO_MIN, width / height));
}

export function toMediaVM(dto: MediaResponseDto): MediaViewModel {
  return {
    id: dto.id,
    kind: dto.kind,
    isVideo: dto.kind === "video",
    purpose: dto.purpose,
    mimeType: dto.mime_type,
    url: dto.url,
    width: dto.width,
    height: dto.height,
    durationMs: dto.duration_ms,
    aspectRatio: clampAspectRatio(dto.width, dto.height),
  };
}
