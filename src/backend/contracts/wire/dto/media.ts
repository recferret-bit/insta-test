import { z } from "zod";
import { LIMITS } from "../limits.ts";
import { MediaPurposeDto } from "./common.ts";

export { MediaResponseDto } from "./common.ts";

const dimension = z.coerce.number().int().min(1).max(LIMITS.mediaDimensionMax);

/**
 * Non-file multipart parts of `POST /media` (`UploadMediaRequest`). The `file` part is streamed separately.
 * Kind-dependent rules (video requires `duration_ms`; width/height only for videos; avatar must be an image)
 * depend on the sniffed type and are enforced by MediaService.
 */
export const UploadMediaFields = z
  .object({
    purpose: MediaPurposeDto,
    width: dimension.optional(),
    height: dimension.optional(),
    duration_ms: z.coerce.number().int().min(1).max(LIMITS.videoDurationMsMax).optional(),
  })
  .strict();
export type UploadMediaFields = z.infer<typeof UploadMediaFields>;

/** Served media key: only `<yyyy>/<mm>/<uuid>.<ext>` is accepted (path traversal guard). */
export const MEDIA_STORAGE_KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$/;
