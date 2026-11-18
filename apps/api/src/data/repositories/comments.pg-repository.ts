import type pg from "pg";

import type { Comment } from "../../domain/posts/comment.entity.js";
import type { CommentRepository } from "../../domain/posts/ports.js";
import type { CommentView } from "../../domain/posts/views.js";
import { DomainError } from "../../domain/shared/errors.js";
import type { CommentId, PostId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import { isForeignKeyViolation } from "../db/pg-errors.js";
import { queryable } from "../db/tx.js";
import {
  mapCommentEntityToRow,
  mapCommentRowToEntity,
  mapCommentViewRow,
} from "../mappers/comments.row-mapper.js";
import type { CommentRow, CommentViewRow } from "../rows/comments.row.js";

const COMMENT_COLUMNS = "id, post_id, author_id, text, created_at, deleted_at";

/**
 * `CommentViewRow` select: `comments` columns + `author_*` summary. The comment ports take no viewer,
 * so `author_is_following` is always `NULL`.
 */
const COMMENT_VIEW_SELECT = `
  SELECT c.id, c.post_id, c.author_id, c.text, c.created_at, c.deleted_at,
         au.username AS author_username, au.full_name AS author_full_name,
         am.storage_key AS author_avatar_storage_key,
         NULL::boolean AS author_is_following
    FROM comments c
    JOIN users au ON au.id = c.author_id
    LEFT JOIN media_assets am ON am.id = au.avatar_media_id`;

const GET_VIEW_SQL = `${COMMENT_VIEW_SELECT}
   WHERE c.id = $1 AND c.deleted_at IS NULL`;

/** Comment page (`comments_post_idx`), oldest first: `$1` post, `$2`/`$3` cursor, `$4` limit + 1. */
const LIST_BY_POST_SQL = `${COMMENT_VIEW_SELECT}
   WHERE c.post_id = $1 AND c.deleted_at IS NULL
     AND ($2::timestamptz IS NULL OR (c.created_at, c.id) > ($2::timestamptz, $3::uuid))
   ORDER BY c.created_at ASC, c.id ASC
   LIMIT $4`;

/** `comments` adapter (`F-BE-04`, persistence/01-schema.md#comments). */
export class PgCommentRepository implements CommentRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(c: Comment, tx: Tx): Promise<void> {
    const row = mapCommentEntityToRow(c);
    try {
      await queryable(this.pool, tx).query(
        `INSERT INTO comments (${COMMENT_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.id, row.post_id, row.author_id, row.text, row.created_at, row.deleted_at],
      );
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new DomainError("NOT_FOUND", "Referenced resource not found");
      throw err;
    }
  }

  /** Live comment. Inside a tx the row is locked `FOR UPDATE` (serialises concurrent deletes). */
  async findLive(id: CommentId, tx?: Tx): Promise<Comment | null> {
    const lock = tx ? " FOR UPDATE" : "";
    const { rows } = await queryable(this.pool, tx).query<CommentRow>(
      `SELECT ${COMMENT_COLUMNS} FROM comments WHERE id = $1 AND deleted_at IS NULL${lock}`,
      [id],
    );
    const row = rows[0];
    return row ? mapCommentRowToEntity(row) : null;
  }

  async softDelete(id: CommentId, now: Date, tx: Tx): Promise<void> {
    await queryable(this.pool, tx).query(
      "UPDATE comments SET deleted_at = $2 WHERE id = $1 AND deleted_at IS NULL",
      [id, now],
    );
  }

  async getView(id: CommentId): Promise<CommentView | null> {
    const { rows } = await this.pool.query<CommentViewRow>(GET_VIEW_SQL, [id]);
    const row = rows[0];
    return row ? mapCommentViewRow(row) : null;
  }

  /** Keyset page on `(created_at, id)` ASC; fetches `limit + 1` rows to decide `nextCursor`. */
  async listByPost(postId: PostId, page: PageRequest<TimeCursor>): Promise<Page<CommentView, TimeCursor>> {
    const { rows } = await this.pool.query<CommentViewRow>(LIST_BY_POST_SQL, [
      postId,
      page.cursor?.t ?? null,
      page.cursor?.id ?? null,
      page.limit + 1,
    ]);
    const pageRows = rows.slice(0, page.limit);
    const last = pageRows[pageRows.length - 1];
    const nextCursor = rows.length > page.limit && last ? { t: last.created_at, id: last.id } : null;
    return { items: pageRows.map(mapCommentViewRow), nextCursor };
  }
}
