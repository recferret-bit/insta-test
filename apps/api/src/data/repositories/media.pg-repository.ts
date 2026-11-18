import type pg from "pg";

import type { MediaAsset } from "../../domain/media/media-asset.entity.js";
import type { MediaRepository } from "../../domain/media/ports.js";
import type { MediaId } from "../../domain/shared/ids.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import { queryable } from "../db/tx.js";
import { mapMediaEntityToRow, mapMediaRowToEntity } from "../mappers/media.row-mapper.js";
import type { MediaAssetRow } from "../rows/media.row.js";

export const MEDIA_COLUMNS =
  "id, owner_id, purpose, kind, mime_type, storage_key, byte_size, width, height, duration_ms, status, created_at";

/**
 * Oldest unattached assets first (`media_assets_unattached_idx`); `SKIP LOCKED` leaves rows that a
 * concurrent post/story/avatar transaction holds `FOR UPDATE`, and the outer `status` re-check
 * (evaluated after the lock) never deletes a row that was attached in the meantime.
 */
const DELETE_UNATTACHED_SQL = `
  DELETE FROM media_assets
   WHERE id IN (SELECT id FROM media_assets
                 WHERE status = 'uploaded' AND created_at < $1
                 ORDER BY created_at
                 LIMIT $2
                 FOR UPDATE SKIP LOCKED)
     AND status = 'uploaded'
  RETURNING ${MEDIA_COLUMNS}`;

/** `media_assets` adapter (`F-BE-02`, persistence/01-schema.md#media_assets). */
export class PgMediaRepository implements MediaRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(m: MediaAsset): Promise<void> {
    const row = mapMediaEntityToRow(m);
    await this.pool.query(
      `INSERT INTO media_assets (${MEDIA_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        row.id,
        row.owner_id,
        row.purpose,
        row.kind,
        row.mime_type,
        row.storage_key,
        row.byte_size,
        row.width,
        row.height,
        row.duration_ms,
        row.status,
        row.created_at,
      ],
    );
  }

  /** Locks the found rows in `id` order (deadlock-free across concurrent callers); missing ids are omitted. */
  async findManyForUpdate(ids: MediaId[], tx: Tx): Promise<MediaAsset[]> {
    if (ids.length === 0) return [];
    const { rows } = await queryable(this.pool, tx).query<MediaAssetRow>(
      `SELECT ${MEDIA_COLUMNS} FROM media_assets WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [ids],
    );
    return rows.map(mapMediaRowToEntity);
  }

  async markAttached(ids: MediaId[], tx: Tx): Promise<void> {
    if (ids.length === 0) return;
    await queryable(this.pool, tx).query(
      "UPDATE media_assets SET status = 'attached' WHERE id = ANY($1::uuid[])",
      [ids],
    );
  }

  async deleteUnattachedOlderThan(cutoff: Date, limit: number): Promise<MediaAsset[]> {
    const { rows } = await this.pool.query<MediaAssetRow>(DELETE_UNATTACHED_SQL, [cutoff, limit]);
    return rows.map(mapMediaRowToEntity);
  }
}
