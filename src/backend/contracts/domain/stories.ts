import type { UserSummaryView } from "./identity.ts";
import type { MediaAsset } from "./media.ts";
import type { MediaId, StoryId, UserId } from "./shared/ids.ts";

/** ENT-Story, ENT-StoryView business entities (backend/01-business-entities.md#story, #storyseen). */

export type Story = { id: StoryId; authorId: UserId; mediaId: MediaId; createdAt: Date; expiresAt: Date };

export type StoryItemView = {
  id: StoryId;
  author: UserSummaryView;
  media: MediaAsset;
  createdAt: Date;
  expiresAt: Date;
  viewerHasSeen: boolean;
  /** Author only; `null` for everyone else. */
  viewCount: number | null;
};

export type StoryTrayItem = { user: UserSummaryView; hasUnseen: boolean; latestStoryAt: Date; storyCount: number };
export type StoryViewerView = { user: UserSummaryView; viewedAt: Date };

/** Not created when `viewerId === story.authorId`. */
export type StorySeen = { storyId: StoryId; viewerId: UserId; viewedAt: Date };

export type CreateStoryCommand = { authorId: UserId; mediaId: MediaId };

export function isStoryActive(story: Pick<Story, "expiresAt">, now: Date): boolean {
  return now.getTime() < story.expiresAt.getTime();
}
