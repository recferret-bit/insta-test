/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

/** `stories` */
export type StoryRow = {
  id: string;
  author_id: string;
  media_id: string;
  created_at: Date;
  expires_at: Date;
};

/** `story_views` — PK `(story_id, viewer_id)`. */
export type StoryViewRow = { story_id: string; viewer_id: string; viewed_at: Date };
