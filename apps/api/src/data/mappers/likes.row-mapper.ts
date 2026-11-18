import type { UserRelationView } from "../../domain/identity/views.js";
import type { Like } from "../../domain/posts/like.entity.js";
import type { PostId, UserId } from "../../domain/shared/ids.js";
import type { PostLikeRow, PostLikerViewRow } from "../rows/likes.row.js";
import { mapUserSummaryViewRow } from "./users.row-mapper.js";

/** `ENT-Like` Row → Business Entity (persistence/03-row-mappers.md#mapper-catalog). */
export function mapPostLikeRowToEntity(row: PostLikeRow): Like {
  return { postId: row.post_id as PostId, userId: row.user_id as UserId, createdAt: row.created_at };
}

/** `ENT-Like` Business Entity → Row. */
export function mapLikeEntityToRow(like: Like): PostLikeRow {
  return { post_id: like.postId, user_id: like.userId, created_at: like.createdAt };
}

/** Likers list query row → `UserRelationView` (`relationAt` = like time). */
export function mapPostLikerViewRow(row: PostLikerViewRow): UserRelationView {
  return { ...mapUserSummaryViewRow(row, ""), relationAt: row.liked_at };
}
