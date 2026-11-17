/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

/** `post_likes` — PK `(post_id, user_id)`. */
export type PostLikeRow = { post_id: string; user_id: string; created_at: Date };
