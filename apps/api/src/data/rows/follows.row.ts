/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

/** `follows` — PK `(follower_id, followee_id)`. */
export type FollowRow = { follower_id: string; followee_id: string; created_at: Date };
