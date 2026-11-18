import type pg from "pg";

import type { UserRelationView } from "../../domain/identity/views.js";
import { DomainError } from "../../domain/shared/errors.js";
import type { UserId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import type { Follow } from "../../domain/social/follow.entity.js";
import type { FollowRepository } from "../../domain/social/ports.js";
import { isCheckViolation, isForeignKeyViolation } from "../db/pg-errors.js";
import { queryable } from "../db/tx.js";
import { mapFollowEntityToRow } from "../mappers/follows.row-mapper.js";
import { mapUserSummaryViewRow } from "../mappers/users.row-mapper.js";
import type { UserSummaryViewRow } from "../rows/users.row.js";

/** Followers/following query row: the listed user's summary columns plus the follow `created_at`. */
type FollowRelationViewRow = UserSummaryViewRow & { relation_at: Date };

/** Which side of `follows` is the list owner (`$1`) and which side is listed. */
type ListSide = { owner: "followee_id" | "follower_id"; listed: "follower_id" | "followee_id" };

const FOLLOWERS: ListSide = { owner: "followee_id", listed: "follower_id" };
const FOLLOWING: ListSide = { owner: "follower_id", listed: "followee_id" };

/**
 * Keyset page over `follows` (`DEC-10`), ordered by relation time DESC then listed user id DESC.
 * The sort key is truncated to milliseconds so it round-trips through the ISO cursor exactly
 * (`DEFAULT now()` rows carry microseconds). `$1` owner, `$2` viewer, `$3`/`$4` cursor, `$5` limit + 1.
 */
function listSql({ owner, listed }: ListSide): string {
  return `
  SELECT u.id, u.username, u.full_name,
         m.storage_key AS avatar_storage_key,
         CASE WHEN $2::uuid IS NULL OR $2::uuid = u.id THEN NULL
              ELSE EXISTS (SELECT 1 FROM follows v WHERE v.follower_id = $2::uuid AND v.followee_id = u.id)
         END AS is_following,
         date_trunc('milliseconds', f.created_at) AS relation_at
    FROM follows f
    JOIN users u ON u.id = f.${listed}
    LEFT JOIN media_assets m ON m.id = u.avatar_media_id
   WHERE f.${owner} = $1
     AND ($3::timestamptz IS NULL
          OR (date_trunc('milliseconds', f.created_at), f.${listed}) < ($3::timestamptz, $4::uuid))
   ORDER BY date_trunc('milliseconds', f.created_at) DESC, f.${listed} DESC
   LIMIT $5`;
}

const FOLLOWERS_SQL = listSql(FOLLOWERS);
const FOLLOWING_SQL = listSql(FOLLOWING);

/** Pg errors → domain (persistence/03-row-mappers.md#error-translation-repositories). */
function translateInsertError(err: unknown): unknown {
  if (isCheckViolation(err, "follows_check")) {
    return new DomainError("CANNOT_FOLLOW_SELF", "You cannot follow yourself");
  }
  if (isForeignKeyViolation(err)) {
    return new DomainError("NOT_FOUND", "User not found");
  }
  return err;
}

/** `follows` adapter (`F-BE-05`). */
export class PgFollowRepository implements FollowRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** `true` when the relation was created, `false` when it already existed (`ON CONFLICT DO NOTHING`). */
  async insertIfAbsent(f: Follow, tx: Tx): Promise<boolean> {
    const row = mapFollowEntityToRow(f);
    try {
      const result = await queryable(this.pool, tx).query(
        `INSERT INTO follows (follower_id, followee_id, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (follower_id, followee_id) DO NOTHING`,
        [row.follower_id, row.followee_id, row.created_at],
      );
      return result.rowCount === 1;
    } catch (err) {
      throw translateInsertError(err);
    }
  }

  /** `true` when a relation was removed. */
  async deleteIfPresent(followerId: UserId, followeeId: UserId, tx: Tx): Promise<boolean> {
    const result = await queryable(this.pool, tx).query(
      "DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2",
      [followerId, followeeId],
    );
    return result.rowCount === 1;
  }

  async listFollowers(
    userId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>> {
    return this.list(FOLLOWERS_SQL, userId, viewerId, page);
  }

  async listFollowing(
    userId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>> {
    return this.list(FOLLOWING_SQL, userId, viewerId, page);
  }

  /** Fetches `limit + 1` rows; the extra row only signals that a next page exists. */
  private async list(
    sql: string,
    ownerId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>> {
    const { rows } = await this.pool.query<FollowRelationViewRow>(sql, [
      ownerId,
      viewerId,
      page.cursor?.t ?? null,
      page.cursor?.id ?? null,
      page.limit + 1,
    ]);
    const items = rows.slice(0, page.limit).map(mapFollowRelationViewRow);
    const last = items.at(-1);
    const nextCursor = rows.length > page.limit && last ? { t: last.relationAt, id: last.id } : null;
    return { items, nextCursor };
  }
}

/** List query row → `UserRelationView` (summary columns + relation time). */
export function mapFollowRelationViewRow(row: FollowRelationViewRow): UserRelationView {
  return { ...mapUserSummaryViewRow(row, ""), relationAt: row.relation_at };
}
