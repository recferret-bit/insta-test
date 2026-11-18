import type { StoryId, UserId } from "../shared/ids.js";
import type { Story } from "./story.entity.js";

/** Not created when `viewerId === story.authorId`. First view wins. */
export type StorySeen = { storyId: StoryId; viewerId: UserId; viewedAt: Date };

/** Entity factory for `ENT-StoryView` (backend/01-business-entities.md#storyseen). */
export const StorySeen = {
  /**
   * Seen record for `viewerId`, or `null` when the author views their own story (never recorded).
   * Activity (`INV-06`) is checked by the service before calling this.
   */
  create(story: Pick<Story, "id" | "authorId">, viewerId: UserId, now: Date): StorySeen | null {
    if (viewerId === story.authorId) return null;
    return { storyId: story.id, viewerId, viewedAt: now };
  },
};
