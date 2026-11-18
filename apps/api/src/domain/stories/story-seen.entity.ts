import type { StoryId, UserId } from "../shared/ids.js";

/** Not created when `viewerId === story.authorId`. First view wins. */
export type StorySeen = { storyId: StoryId; viewerId: UserId; viewedAt: Date };
