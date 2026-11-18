import type { MediaId, StoryId, UserId } from "../../domain/shared/ids.js";
import type { StorySeen } from "../../domain/stories/story-seen.entity.js";
import type { Story } from "../../domain/stories/story.entity.js";
import type { StoryRow, StoryViewRow } from "../rows/stories.row.js";

/** `ENT-Story` Row → Business Entity (persistence/03-row-mappers.md#mapper-catalog). */
export function mapStoryRowToEntity(row: StoryRow): Story {
  return {
    id: row.id as StoryId,
    authorId: row.author_id as UserId,
    mediaId: row.media_id as MediaId,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/** `ENT-Story` Business Entity → Row. */
export function mapStoryEntityToRow(story: Story): StoryRow {
  return {
    id: story.id,
    author_id: story.authorId,
    media_id: story.mediaId,
    created_at: story.createdAt,
    expires_at: story.expiresAt,
  };
}

/** `ENT-StoryView` Row → `StorySeen`. */
export function mapStoryViewRowToEntity(row: StoryViewRow): StorySeen {
  return {
    storyId: row.story_id as StoryId,
    viewerId: row.viewer_id as UserId,
    viewedAt: row.viewed_at,
  };
}

/** `StorySeen` → `ENT-StoryView` Row. */
export function mapStorySeenEntityToRow(seen: StorySeen): StoryViewRow {
  return { story_id: seen.storyId, viewer_id: seen.viewerId, viewed_at: seen.viewedAt };
}
