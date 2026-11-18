import type pg from "pg";

import type { Post } from "../../domain/posts/post.entity.js";
import type { PostCounterDelta, PostRepository } from "../../domain/posts/ports.js";
import type { PostView } from "../../domain/posts/views.js";
import { DomainError } from "../../domain/shared/errors.js";
import type { PostId, UserId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import { isForeignKeyViolation, isUniqueViolation } from "../db/pg-errors.js";
import { queryable, type Queryable } from "../db/tx.js";
import { mapPostEntityToRows, mapPostRowsToEntity, mapPostViewRows } from "../mappers/posts.row-mapper.js";
import type {
  PostHashtagRow,
  PostMediaRow,
  PostMediaViewRow,
  PostRow,
  PostViewRow,
} from "../rows/posts.row.js";
import { MEDIA_COLUMNS } from "./media.pg-repository.js";

const POST_COLUMNS = "id, author_id, caption, like_count, comment_count, created_at, updated_at, deleted_at";

const qualified = (alias: string, columns: string): string =>
  columns
    .split(", ")
    .map((c) => `${alias}.${c}`)
    .join(", ");

/**
 * Select list of a `PostViewRow`: `posts` columns plus the `author_*` user summary. `viewerParam` is the
 * placeholder holding the viewer id (`NULL` when anonymous); `author_is_following` is `NULL` for anonymous/self.
 * Use with {@link POST_VIEW_FROM}. Exported so other read models (w05 feed/search) build identical rows.
 */
export function postViewSelectList(viewerParam: string): string {
  return `${qualified("p", POST_COLUMNS)},
         au.username AS author_username, au.full_name AS author_full_name,
         am.storage_key AS author_avatar_storage_key,
         CASE WHEN ${viewerParam}::uuid IS NULL OR ${viewerParam}::uuid = p.author_id THEN NULL
              ELSE EXISTS (SELECT 1 FROM follows f
                            WHERE f.follower_id = ${viewerParam}::uuid AND f.followee_id = p.author_id)
         END AS author_is_following`;
}

/** `FROM` clause matching {@link postViewSelectList} (`p` = posts, `au` = author, `am` = avatar media). */
export const POST_VIEW_FROM = `posts p
    JOIN users au ON au.id = p.author_id
    LEFT JOIN media_assets am ON am.id = au.avatar_media_id`;

/** Profile grid page (`posts_author_feed_idx`): `$1` author, `$2` viewer, `$3`/`$4` cursor, `$5` limit + 1. */
const LIST_BY_AUTHOR_SQL = `
  SELECT ${postViewSelectList("$2")}
    FROM ${POST_VIEW_FROM}
   WHERE p.author_id = $1 AND p.deleted_at IS NULL
     AND ($3::timestamptz IS NULL OR (p.created_at, p.id) < ($3::timestamptz, $4::uuid))
   ORDER BY p.created_at DESC, p.id DESC
   LIMIT $5`;

const GET_VIEW_SQL = `
  SELECT ${postViewSelectList("$2")}
    FROM ${POST_VIEW_FROM}
   WHERE p.id = $1 AND p.deleted_at IS NULL`;

const HYDRATE_MEDIA_SQL = `
  SELECT pm.post_id, pm.position, ${qualified("m", MEDIA_COLUMNS)}
    FROM post_media pm
    JOIN media_assets m ON m.id = pm.media_id
   WHERE pm.post_id = ANY($1::uuid[])
   ORDER BY pm.post_id, pm.position`;

const HYDRATE_TAGS_SQL = `
  SELECT post_id, tag, position FROM post_hashtags
   WHERE post_id = ANY($1::uuid[])
   ORDER BY post_id, position`;

const HYDRATE_LIKED_SQL = `
  SELECT post_id FROM post_likes WHERE user_id = $2 AND post_id = ANY($1::uuid[])`;

function groupByPost<R extends { post_id: string }>(rows: R[]): Map<string, R[]> {
  const groups = new Map<string, R[]>();
  for (const row of rows) {
    const list = groups.get(row.post_id);
    if (list) list.push(row);
    else groups.set(row.post_id, [row]);
  }
  return groups;
}

/**
 * Batched hydration of a page of {@link PostViewRow}s into `PostView`s, preserving input order: one query each
 * for `post_media ⋈ media_assets`, `post_hashtags` and (signed-in viewer only) `viewer_has_liked`, all keyed by
 * `post_id = ANY($ids)` — a constant number of queries per page, never N+1. Reused by the w05 feed adapter.
 */
export async function hydratePostViews(
  db: Queryable,
  postRows: PostViewRow[],
  viewerId: UserId | null,
): Promise<PostView[]> {
  if (postRows.length === 0) return [];
  const ids = postRows.map((r) => r.id);
  // Sequential on purpose: `db` may be a single tx client, which must not run overlapping queries.
  const media = await db.query<PostMediaViewRow>(HYDRATE_MEDIA_SQL, [ids]);
  const tags = await db.query<PostHashtagRow>(HYDRATE_TAGS_SQL, [ids]);
  const liked =
    viewerId === null
      ? { rows: [] as { post_id: string }[] }
      : await db.query<{ post_id: string }>(HYDRATE_LIKED_SQL, [ids, viewerId]);
  const mediaByPost = groupByPost(media.rows);
  const tagsByPost = groupByPost(tags.rows);
  const likedIds = new Set(liked.rows.map((r) => r.post_id));
  return postRows.map((row) =>
    mapPostViewRows(
      row,
      row,
      mediaByPost.get(row.id) ?? [],
      tagsByPost.get(row.id) ?? [],
      likedIds.has(row.id),
    ),
  );
}

/** `posts` insert errors (persistence/03-row-mappers.md#error-translation). */
function translateInsertError(err: unknown): unknown {
  if (isUniqueViolation(err, "post_media_media_id_key")) {
    return new DomainError("MEDIA_INVALID", "Media is already attached");
  }
  if (isForeignKeyViolation(err)) return new DomainError("NOT_FOUND", "Referenced resource not found");
  return err;
}

/** `posts` + `post_media` + `post_hashtags` adapter (`F-BE-03`, persistence/01-schema.md#posts). */
export class PgPostRepository implements PostRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(post: Post, tx: Tx): Promise<void> {
    const rows = mapPostEntityToRows(post);
    const db = queryable(this.pool, tx);
    try {
      await db.query(`INSERT INTO posts (${POST_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
        rows.post.id,
        rows.post.author_id,
        rows.post.caption,
        rows.post.like_count,
        rows.post.comment_count,
        rows.post.created_at,
        rows.post.updated_at,
        rows.post.deleted_at,
      ]);
      await db.query(
        `INSERT INTO post_media (post_id, media_id, position)
         SELECT $1::uuid, * FROM unnest($2::uuid[], $3::smallint[])`,
        [post.id, rows.media.map((m) => m.media_id), rows.media.map((m) => m.position)],
      );
      await this.insertHashtags(db, rows.hashtags, post.id);
    } catch (err) {
      throw translateInsertError(err);
    }
  }

  /** Live post aggregate. Inside a tx the `posts` row is locked `FOR NO KEY UPDATE` (serialises edit/delete). */
  async findLive(id: PostId, tx?: Tx): Promise<Post | null> {
    const db = queryable(this.pool, tx);
    const lock = tx ? " FOR NO KEY UPDATE" : "";
    const { rows } = await db.query<PostRow>(
      `SELECT ${POST_COLUMNS} FROM posts WHERE id = $1 AND deleted_at IS NULL${lock}`,
      [id],
    );
    const post = rows[0];
    if (!post) return null;
    const media = await db.query<PostMediaRow>(
      "SELECT post_id, media_id, position FROM post_media WHERE post_id = $1",
      [id],
    );
    const tags = await db.query<PostHashtagRow>(
      "SELECT post_id, tag, position FROM post_hashtags WHERE post_id = $1",
      [id],
    );
    return mapPostRowsToEntity(post, media.rows, tags.rows);
  }

  /** Caption + `updated_at`, then replaces `post_hashtags` (delete + insert). Media are immutable. */
  async updateCaption(post: Post, tx: Tx): Promise<void> {
    const rows = mapPostEntityToRows(post);
    const db = queryable(this.pool, tx);
    await db.query("UPDATE posts SET caption = $2, updated_at = $3 WHERE id = $1 AND deleted_at IS NULL", [
      rows.post.id,
      rows.post.caption,
      rows.post.updated_at,
    ]);
    await db.query("DELETE FROM post_hashtags WHERE post_id = $1", [post.id]);
    await this.insertHashtags(db, rows.hashtags, post.id);
  }

  async softDelete(id: PostId, now: Date, tx: Tx): Promise<void> {
    await queryable(this.pool, tx).query(
      "UPDATE posts SET deleted_at = $2 WHERE id = $1 AND deleted_at IS NULL",
      [id, now],
    );
  }

  /** Atomic `col = col + delta … RETURNING` (`DEC-11`); `NOT_FOUND` when the post row does not exist. */
  async adjustCounters(
    id: PostId,
    delta: PostCounterDelta,
    tx: Tx,
  ): Promise<{ likeCount: number; commentCount: number }> {
    const { rows } = await queryable(this.pool, tx).query<Pick<PostRow, "like_count" | "comment_count">>(
      `UPDATE posts
          SET like_count = like_count + $2, comment_count = comment_count + $3
        WHERE id = $1
       RETURNING like_count, comment_count`,
      [id, delta.likes ?? 0, delta.comments ?? 0],
    );
    const row = rows[0];
    if (!row) throw new DomainError("NOT_FOUND", "Post not found");
    return { likeCount: row.like_count, commentCount: row.comment_count };
  }

  async getView(id: PostId, viewerId: UserId | null): Promise<PostView | null> {
    const { rows } = await this.pool.query<PostViewRow>(GET_VIEW_SQL, [id, viewerId]);
    const [view] = await hydratePostViews(this.pool, rows, viewerId);
    return view ?? null;
  }

  /** Keyset page on `(created_at, id)` DESC; fetches `limit + 1` rows to decide `nextCursor`. */
  async listByAuthor(
    authorId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<PostView, TimeCursor>> {
    const { rows } = await this.pool.query<PostViewRow>(LIST_BY_AUTHOR_SQL, [
      authorId,
      viewerId,
      page.cursor?.t ?? null,
      page.cursor?.id ?? null,
      page.limit + 1,
    ]);
    const pageRows = rows.slice(0, page.limit);
    const last = pageRows[pageRows.length - 1];
    const nextCursor = rows.length > page.limit && last ? { t: last.created_at, id: last.id } : null;
    return { items: await hydratePostViews(this.pool, pageRows, viewerId), nextCursor };
  }

  private async insertHashtags(db: Queryable, tags: PostHashtagRow[], postId: PostId): Promise<void> {
    if (tags.length === 0) return;
    await db.query(
      `INSERT INTO post_hashtags (post_id, tag, position)
       SELECT $1::uuid, * FROM unnest($2::text[], $3::smallint[])`,
      [postId, tags.map((t) => t.tag), tags.map((t) => t.position)],
    );
  }
}
