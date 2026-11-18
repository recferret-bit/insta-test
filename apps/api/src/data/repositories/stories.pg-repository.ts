import type pg from "pg";

import type { MediaPurpose, MediaKind, MediaStatus } from "../../domain/media/media-asset.entity.js";
import { DomainError } from "../../domain/shared/errors.js";
import type { StoryId, UserId } from "../../domain/shared/ids.js";
import { DOMAIN_LIMITS } from "../../domain/shared/limits.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import type { StoryRepository } from "../../domain/stories/ports.js";
import type { StorySeen } from "../../domain/stories/story-seen.entity.js";
import type { Story } from "../../domain/stories/story.entity.js";
import type { StoryItemView, StoryTrayItem, StoryViewerView } from "../../domain/stories/views.js";
import { isForeignKeyViolation, isUniqueViolation } from "../db/pg-errors.js";
import { queryable } from "../db/tx.js";
import { mapMediaRowToEntity } from "../mappers/media.row-mapper.js";
import {
  mapStoryEntityToRow,
  mapStoryRowToEntity,
  mapStorySeenEntityToRow,
} from "../mappers/stories.row-mapper.js";
import { mapUserSummaryViewRow } from "../mappers/users.row-mapper.js";
import type { StoryRow } from "../rows/stories.row.js";
import type { UserSummaryViewRow } from "../rows/users.row.js";

const STORY_COLUMNS = "id, author_id, media_id, created_at, expires_at";

/* ---------- Query result rows (read models; not table mirrors) ---------- */

/** `StoryItemView` query row: story columns + `author_*` summary + `media_*` asset + viewer flags. */
type StoryItemViewRow = StoryRow &
  UserSummaryViewRow<"author_"> & {
    media_owner_id: string;
    media_purpose: MediaPurpose;
    media_kind: MediaKind;
    media_mime_type: string;
    media_storage_key: string;
    media_byte_size: string;
    media_width: number | null;
    media_height: number | null;
    media_duration_ms: number | null;
    media_status: MediaStatus;
    media_created_at: Date;
    viewer_has_seen: boolean;
    /** `count(*)` (bigint → string) for the author, else `NULL`. */
    view_count: string | null;
  };

type StoryTrayRow = UserSummaryViewRow & {
  has_unseen: boolean;
  latest_story_at: Date;
  story_count: number;
};

type StoryViewerRow = UserSummaryViewRow & { viewed_at: Date };

function mapStoryItemViewRow(row: StoryItemViewRow): StoryItemView {
  const story = mapStoryRowToEntity(row);
  return {
    id: story.id,
    author: mapUserSummaryViewRow(row, "author_"),
    media: mapMediaRowToEntity({
      id: row.media_id,
      owner_id: row.media_owner_id,
      purpose: row.media_purpose,
      kind: row.media_kind,
      mime_type: row.media_mime_type,
      storage_key: row.media_storage_key,
      byte_size: row.media_byte_size,
      width: row.media_width,
      height: row.media_height,
      duration_ms: row.media_duration_ms,
      status: row.media_status,
      created_at: row.media_created_at,
    }),
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    viewerHasSeen: row.viewer_has_seen,
    viewCount: row.view_count === null ? null : Number(row.view_count),
  };
}

function mapStoryTrayRow(row: StoryTrayRow): StoryTrayItem {
  return {
    user: mapUserSummaryViewRow(row, ""),
    hasUnseen: row.has_unseen,
    latestStoryAt: row.latest_story_at,
    storyCount: row.story_count,
  };
}

function mapStoryViewerRow(row: StoryViewerRow): StoryViewerView {
  return { user: mapUserSummaryViewRow(row, ""), viewedAt: row.viewed_at };
}

/* ---------- SQL ---------- */

/**
 * `StoryItemView` select. Params: `$1` viewer (nullable uuid), `$2` now. Callers append `AND …` filters.
 * `viewer_has_seen` is `false` for anonymous; `view_count` only for the author (`INV-06` via `expires_at > $2`).
 */
const STORY_ITEM_SELECT = `
  SELECT s.id, s.author_id, s.media_id, s.created_at, s.expires_at,
         u.username AS author_username, u.full_name AS author_full_name,
         av.storage_key AS author_avatar_storage_key,
         CASE WHEN $1::uuid IS NULL OR $1::uuid = u.id THEN NULL
              ELSE EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1::uuid AND f.followee_id = u.id)
         END AS author_is_following,
         m.owner_id AS media_owner_id, m.purpose AS media_purpose, m.kind AS media_kind,
         m.mime_type AS media_mime_type, m.storage_key AS media_storage_key, m.byte_size AS media_byte_size,
         m.width AS media_width, m.height AS media_height, m.duration_ms AS media_duration_ms,
         m.status AS media_status, m.created_at AS media_created_at,
         CASE WHEN $1::uuid IS NULL THEN false
              ELSE EXISTS (SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = $1::uuid)
         END AS viewer_has_seen,
         CASE WHEN $1::uuid = s.author_id
              THEN (SELECT count(*) FROM story_views sv WHERE sv.story_id = s.id)
         END AS view_count
    FROM stories s
    JOIN users u ON u.id = s.author_id
    JOIN media_assets m ON m.id = s.media_id
    LEFT JOIN media_assets av ON av.id = u.avatar_media_id
   WHERE s.expires_at > $2`;

/**
 * Tray: authors (followees ∪ self) with ≥ 1 active story. `$1` viewer, `$2` now, `$3` limit.
 * Own stories are never recorded as seen, so self is reported `has_unseen = false`.
 * Followees are followed by construction (`is_following = true`); self → `NULL`.
 */
const TRAY_SQL = `
  WITH active AS (
    SELECT s.author_id,
           max(s.created_at) AS latest_story_at,
           count(*)::int AS story_count,
           bool_or(NOT EXISTS (SELECT 1 FROM story_views sv
                                WHERE sv.story_id = s.id AND sv.viewer_id = $1::uuid)) AS any_unseen
      FROM stories s
     WHERE s.expires_at > $2
       AND (s.author_id = $1::uuid
            OR s.author_id IN (SELECT f.followee_id FROM follows f WHERE f.follower_id = $1::uuid))
     GROUP BY s.author_id
  )
  SELECT u.id, u.username, u.full_name, av.storage_key AS avatar_storage_key,
         CASE WHEN u.id = $1::uuid THEN NULL ELSE true END AS is_following,
         CASE WHEN u.id = $1::uuid THEN false ELSE a.any_unseen END AS has_unseen,
         a.latest_story_at, a.story_count
    FROM active a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN media_assets av ON av.id = u.avatar_media_id
   ORDER BY (u.id = $1::uuid) DESC, has_unseen DESC, a.latest_story_at DESC, u.id DESC
   LIMIT $3`;

/**
 * Viewers of one story, keyset on `(viewed_at, viewer_id)` DESC (`story_views_story_idx`).
 * `is_following` is relative to the story author (the only caller allowed to list viewers).
 * `$1` story, `$2` cursor time (nullable), `$3` cursor viewer id (nullable), `$4` limit + 1.
 */
const VIEWERS_SQL = `
  SELECT sv.viewed_at, u.id, u.username, u.full_name, av.storage_key AS avatar_storage_key,
         EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = s.author_id AND f.followee_id = u.id)
           AS is_following
    FROM story_views sv
    JOIN stories s ON s.id = sv.story_id
    JOIN users u ON u.id = sv.viewer_id
    LEFT JOIN media_assets av ON av.id = u.avatar_media_id
   WHERE sv.story_id = $1
     AND ($2::timestamptz IS NULL OR (sv.viewed_at, sv.viewer_id) < ($2::timestamptz, $3::uuid))
   ORDER BY sv.viewed_at DESC, sv.viewer_id DESC
   LIMIT $4`;

/**
 * Deleting the `media_assets` row cascades to `stories` (`media_id ON DELETE CASCADE`) and on to
 * `story_views`, so one statement removes story + media + views and returns the file key.
 */
const DELETE_WITH_MEDIA_SQL = `
  DELETE FROM media_assets m
   USING stories s
   WHERE s.id = $1 AND m.id = s.media_id
  RETURNING m.storage_key`;

/**
 * Oldest-expired first (`stories_expires_at_idx`); `SKIP LOCKED` leaves stories that a concurrent
 * `DELETE /stories/{id}` holds. Deletes via `media_assets` (cascades to the story and its views).
 */
const DELETE_EXPIRED_SQL = `
  DELETE FROM media_assets m
   USING (SELECT id, media_id FROM stories
           WHERE expires_at < $1
           ORDER BY expires_at
           LIMIT $2
           FOR UPDATE SKIP LOCKED) d
   WHERE m.id = d.media_id
  RETURNING d.id AS story_id, m.storage_key`;

/** `stories` + `story_views` adapter (`F-BE-06`, `F-BE-09`; persistence/01-schema.md#stories). */
export class PgStoryRepository implements StoryRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** 23505 on `stories_media_id_key` (media already used by a story) → `MEDIA_INVALID` (persistence/03). */
  async insert(s: Story, tx: Tx): Promise<void> {
    const row = mapStoryEntityToRow(s);
    try {
      await queryable(this.pool, tx).query(
        `INSERT INTO stories (${STORY_COLUMNS}) VALUES ($1, $2, $3, $4, $5)`,
        [row.id, row.author_id, row.media_id, row.created_at, row.expires_at],
      );
    } catch (err) {
      if (isUniqueViolation(err, "stories_media_id_key")) {
        throw new DomainError("MEDIA_INVALID", "Media is already attached");
      }
      throw err;
    }
  }

  async findActive(id: StoryId, now: Date): Promise<Story | null> {
    const { rows } = await this.pool.query<StoryRow>(
      `SELECT ${STORY_COLUMNS} FROM stories WHERE id = $1 AND expires_at > $2`,
      [id, now],
    );
    const row = rows[0];
    return row ? mapStoryRowToEntity(row) : null;
  }

  /** A story already removed (concurrent delete / cleanup) → `NOT_FOUND`. */
  async deleteWithMedia(id: StoryId, tx: Tx): Promise<{ storageKey: string }> {
    const { rows } = await queryable(this.pool, tx).query<{ storage_key: string }>(DELETE_WITH_MEDIA_SQL, [
      id,
    ]);
    const row = rows[0];
    if (!row) throw new DomainError("NOT_FOUND", "Story not found");
    return { storageKey: row.storage_key };
  }

  /** `ON CONFLICT DO NOTHING` (first view wins); story deleted meanwhile (FK 23503) → `NOT_FOUND`. */
  async insertSeenIfAbsent(v: StorySeen): Promise<void> {
    const row = mapStorySeenEntityToRow(v);
    try {
      await this.pool.query(
        `INSERT INTO story_views (story_id, viewer_id, viewed_at) VALUES ($1, $2, $3)
         ON CONFLICT (story_id, viewer_id) DO NOTHING`,
        [row.story_id, row.viewer_id, row.viewed_at],
      );
    } catch (err) {
      if (isForeignKeyViolation(err, "story_views_story_id_fkey")) {
        throw new DomainError("NOT_FOUND", "Story not found");
      }
      throw err;
    }
  }

  async tray(viewerId: UserId, now: Date): Promise<StoryTrayItem[]> {
    const { rows } = await this.pool.query<StoryTrayRow>(TRAY_SQL, [
      viewerId,
      now,
      DOMAIN_LIMITS.storyTrayMax,
    ]);
    return rows.map(mapStoryTrayRow);
  }

  async listActiveByAuthor(authorId: UserId, viewerId: UserId | null, now: Date): Promise<StoryItemView[]> {
    const { rows } = await this.pool.query<StoryItemViewRow>(
      `${STORY_ITEM_SELECT} AND s.author_id = $3 ORDER BY s.created_at ASC, s.id ASC`,
      [viewerId, now, authorId],
    );
    return rows.map(mapStoryItemViewRow);
  }

  async getView(id: StoryId, viewerId: UserId | null, now: Date): Promise<StoryItemView | null> {
    const { rows } = await this.pool.query<StoryItemViewRow>(`${STORY_ITEM_SELECT} AND s.id = $3`, [
      viewerId,
      now,
      id,
    ]);
    const row = rows[0];
    return row ? mapStoryItemViewRow(row) : null;
  }

  async listViewers(id: StoryId, page: PageRequest<TimeCursor>): Promise<Page<StoryViewerView, TimeCursor>> {
    const { rows } = await this.pool.query<StoryViewerRow>(VIEWERS_SQL, [
      id,
      page.cursor?.t ?? null,
      page.cursor?.id ?? null,
      page.limit + 1,
    ]);
    const hasMore = rows.length > page.limit;
    const items = rows.slice(0, page.limit).map(mapStoryViewerRow);
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? { t: last.viewedAt, id: last.user.id } : null,
    };
  }

  async deleteExpiredBefore(
    cutoff: Date,
    limit: number,
  ): Promise<{ storyId: StoryId; storageKey: string }[]> {
    const { rows } = await this.pool.query<{ story_id: string; storage_key: string }>(DELETE_EXPIRED_SQL, [
      cutoff,
      limit,
    ]);
    return rows.map((r) => ({ storyId: r.story_id as StoryId, storageKey: r.storage_key }));
  }
}
