import type { MediaId, StoryId, UserId } from "../shared/ids.js";

/** Stories are visible for 24 hours (`INV-06`). */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

/** `expiresAt = createdAt + STORY_TTL_MS`; active while `now < expiresAt`. */
export type Story = { id: StoryId; authorId: UserId; mediaId: MediaId; createdAt: Date; expiresAt: Date };

export type CreateStoryInput = {
  id: StoryId;
  authorId: UserId;
  mediaId: MediaId;
  /** From the injected `Clock` port. */
  now: Date;
};

/** `Story.isActive(story, now) = now < expiresAt` (`INV-06`; the expiry instant itself is expired). */
export function isStoryActive(story: Story, now: Date): boolean {
  return now.getTime() < story.expiresAt.getTime();
}

/** Entity factory for `ENT-Story` (backend/01-business-entities.md#story). */
export const Story = {
  /** New story: `createdAt = now`, `expiresAt = now + 24h`. */
  create(input: CreateStoryInput): Story {
    return {
      id: input.id,
      authorId: input.authorId,
      mediaId: input.mediaId,
      createdAt: input.now,
      expiresAt: new Date(input.now.getTime() + STORY_TTL_MS),
    };
  },

  isActive: isStoryActive,
};
