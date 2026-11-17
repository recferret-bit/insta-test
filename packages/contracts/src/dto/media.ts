import { z } from "zod";

import { LIMITS } from "../limits.js";
import { MediaPurposeDto } from "./common.js";

/**
 * Non-file multipart parts of `POST /media` (`UploadMediaRequest`). Multipart values arrive as
 * text, hence `coerce`. The `file` part (exactly one) is handled by the route, not by this schema.
 * `duration_ms` is required for videos; the kind is only known after sniffing, so that rule is
 * enforced by `MediaService.upload`.
 */
export const UploadMediaFields = z
  .object({
    purpose: MediaPurposeDto,
    width: z.coerce.number().int().min(1).max(LIMITS.mediaDimensionMax).optional(),
    height: z.coerce.number().int().min(1).max(LIMITS.mediaDimensionMax).optional(),
    duration_ms: z.coerce.number().int().min(1).max(LIMITS.videoDurationMsMax).optional(),
  })
  .strict();
export type UploadMediaFields = z.infer<typeof UploadMediaFields>;

/** Only storage keys matching this pattern are served by `GET /media/{storage_key}` (no traversal). */
export const MEDIA_STORAGE_KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$/;
