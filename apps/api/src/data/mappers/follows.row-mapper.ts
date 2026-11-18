import type { UserId } from "../../domain/shared/ids.js";
import type { Follow } from "../../domain/social/follow.entity.js";
import type { FollowRow } from "../rows/follows.row.js";

/** `ENT-Follow` Row → Business Entity (persistence/03-row-mappers.md#mapper-catalog). */
export function mapFollowRowToEntity(row: FollowRow): Follow {
  return {
    followerId: row.follower_id as UserId,
    followeeId: row.followee_id as UserId,
    createdAt: row.created_at,
  };
}

/** `ENT-Follow` Business Entity → Row. */
export function mapFollowEntityToRow(follow: Follow): FollowRow {
  return {
    follower_id: follow.followerId,
    followee_id: follow.followeeId,
    created_at: follow.createdAt,
  };
}
