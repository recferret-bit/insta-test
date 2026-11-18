import type pg from "pg";

import type { UserRelationView } from "../../domain/identity/views.js";
import type { Like } from "../../domain/posts/like.entity.js";
import type { LikeRepository } from "../../domain/posts/ports.js";
import { DomainError } from "../../domain/shared/errors.js";
import type { PostId, UserId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import { isForeignKeyViolation } from "../db/pg-errors.js";
import { queryable } from "../db/tx.js";
import { mapLikeEntityToRow, mapPostLikerViewRow } from "../mappers/likes.row-mapper.js";
import type { PostLikerViewRow } from "../rows/likes.row.js";

/**
 * Likers page (`post_likes_post_recent_idx`), newest like first with `user_id` as the tie-break:
 * `$1` post, `$2` viewer (`NULL` when anonymous), `$3`/`$4` cursor (`liked_at`, `user_id`), `$5` limit + 1.
 * `is_following` is `NULL` for anonymous viewers and for the viewer's own row.
 */
const LIST_LIKERS_SQL = `
  SELECT u.id, u.username, u.full_name,
         am.storage_key AS avatar_storage_key,
         CASE WHEN $2::uuid IS NULL OR $2::uuid = u.id THEN NULL
              ELSE EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $2::uuid AND f.followee_id = u.id)
         END AS is_following,
         l.created_at AS liked_at
    FROM post_likes l
    JOIN users u ON u.id = l.user_id
    LEFT JOIN media_assets am ON am.id = u.avatar_media_id
   WHERE l.post_id = $1
     AND ($3::timestamptz IS NULL OR (l.created_at, l.user_id) < ($3::timestamptz, $4::uuid))
   ORDER BY l.created_at DESC, l.user_id DESC
   LIMIT $5`;

/** `post_likes` adapter (`F-BE-04`, persistence/01-schema.md#post_likes). */
export class PgLikeRepository implements LikeRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** `true` when the like was inserted, `false` when it already existed (PK `(post_id, user_id)`, `INV-02`). */
  async insertIfAbsent(like: Like, tx: Tx): Promise<boolean> {
    const row = mapLikeEntityToRow(like);
    try {
      const result = await queryable(this.pool, tx).query(
        `INSERT INTO post_likes (post_id, user_id, created_at) VALUES ($1, $2, $3)
         ON CONFLICT (post_id, user_id) DO NOTHING`,
        [row.post_id, row.user_id, row.created_at],
      );
      return result.rowCount === 1;
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new DomainError("NOT_FOUND", "Referenced resource not found");
      throw err;
    }
  }

  /** `true` when a like was removed. */
  async deleteIfPresent(postId: PostId, userId: UserId, tx: Tx): Promise<boolean> {
    const result = await queryable(this.pool, tx).query(
      "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2",
      [postId, userId],
    );
    return result.rowCount === 1;
  }

  /** Keyset page on `(created_at, user_id)` DESC; fetches `limit + 1` rows to decide `nextCursor`. */
  async listLikers(
    postId: PostId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>> {
    const { rows } = await this.pool.query<PostLikerViewRow>(LIST_LIKERS_SQL, [
      postId,
      viewerId,
      page.cursor?.t ?? null,
      page.cursor?.id ?? null,
      page.limit + 1,
    ]);
    const pageRows = rows.slice(0, page.limit);
    const last = pageRows[pageRows.length - 1];
    const nextCursor = rows.length > page.limit && last ? { t: last.liked_at, id: last.id } : null;
    return { items: pageRows.map(mapPostLikerViewRow), nextCursor };
  }
}
