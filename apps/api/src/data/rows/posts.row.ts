/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

/** `posts` */
export type PostRow = {
  id: string;
  author_id: string;
  caption: string;
  like_count: number;
  comment_count: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

/** `post_media` — PK `(post_id, position)`. */
export type PostMediaRow = { post_id: string; media_id: string; position: number };

/** `post_hashtags` — PK `(post_id, tag)`; `position` = first-appearance order. */
export type PostHashtagRow = { post_id: string; tag: string; position: number };
