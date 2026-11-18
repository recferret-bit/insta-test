import type { MediaResponseDto, UploadMediaFields } from "@insta/contracts";
import type { Readable } from "node:stream";

import type { UploadMediaCommand } from "../../domain/media/commands.js";
import type { MediaAsset } from "../../domain/media/media-asset.entity.js";
import type { UserId } from "../../domain/shared/ids.js";
import type { UrlBuilder } from "../url-builder.js";
import { toPublicId } from "./shared.dto-mapper.js";

/**
 * Media DTO ↔ Business mappers (external-communication/03-media-and-posts-api.md#mapping-dto--business).
 */

/**
 * Validated multipart text parts + the `file` part stream → `UploadMediaCommand`. `width`/`height` are kept
 * as declared; `MediaService` only uses them for videos (image dimensions are probed server-side).
 */
export function mapUploadMultipartToCommand(
  fields: UploadMediaFields,
  stream: Readable,
  ownerId: UserId,
): UploadMediaCommand {
  const cmd: UploadMediaCommand = { ownerId, purpose: fields.purpose, stream };
  if (fields.width !== undefined) cmd.declaredWidth = fields.width;
  if (fields.height !== undefined) cmd.declaredHeight = fields.height;
  if (fields.duration_ms !== undefined) cmd.durationMs = fields.duration_ms;
  return cmd;
}

/** `MediaAsset` → `MediaResponseDto`; `url` = `${PUBLIC_API_URL}/media/${storageKey}` via `UrlBuilder`. */
export function mapMediaToResponseDto(media: MediaAsset, urls: UrlBuilder): MediaResponseDto {
  return {
    id: toPublicId("med", media.id),
    kind: media.kind,
    purpose: media.purpose,
    mime_type: media.mimeType,
    url: urls.mediaUrl(media.storageKey),
    width: media.width,
    height: media.height,
    duration_ms: media.durationMs,
    size_bytes: media.byteSize,
    created_at: media.createdAt.toISOString(),
  };
}
