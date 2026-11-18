/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

import type { UserSummaryViewRow } from "./users.row.js";

/** `post_likes` — PK `(post_id, user_id)`. */
export type PostLikeRow = { post_id: string; user_id: string; created_at: Date };

/** Likers list query row: liker user summary (no prefix) + `post_likes.created_at` aliased as `liked_at`. */
export type PostLikerViewRow = UserSummaryViewRow & { liked_at: Date };
