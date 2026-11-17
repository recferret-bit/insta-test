import type { MediaId, StoryId, UserId } from "../shared/ids.js";

/** Stories are visible for 24 hours (`INV-06`). */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

/** `expiresAt = createdAt + STORY_TTL_MS`; active while `now < expiresAt`. */
export type Story = { id: StoryId; authorId: UserId; mediaId: MediaId; createdAt: Date; expiresAt: Date };
