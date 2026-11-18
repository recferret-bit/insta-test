import type { MediaAsset, MediaMimeType } from "../../domain/media/media-asset.entity.js";
import type { MediaId, UserId } from "../../domain/shared/ids.js";
import type { MediaAssetRow } from "../rows/media.row.js";

/** `ENT-Media` Row → Business Entity; `byte_size` (`bigint` → string) parsed with `Number()` (< 2^53). */
export function mapMediaRowToEntity(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id as MediaId,
    ownerId: row.owner_id as UserId,
    purpose: row.purpose,
    kind: row.kind,
    mimeType: row.mime_type as MediaMimeType,
    storageKey: row.storage_key,
    byteSize: Number(row.byte_size),
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** `ENT-Media` Business Entity → Row; `byteSize` serialized as a decimal string for the `bigint` column. */
export function mapMediaEntityToRow(media: MediaAsset): MediaAssetRow {
  return {
    id: media.id,
    owner_id: media.ownerId,
    purpose: media.purpose,
    kind: media.kind,
    mime_type: media.mimeType,
    storage_key: media.storageKey,
    byte_size: String(media.byteSize),
    width: media.width,
    height: media.height,
    duration_ms: media.durationMs,
    status: media.status,
    created_at: media.createdAt,
  };
}
