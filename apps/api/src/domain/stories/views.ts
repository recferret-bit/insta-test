import type { UserSummaryView } from "../identity/views.js";
import type { MediaAsset } from "../media/media-asset.entity.js";
import type { StoryId } from "../shared/ids.js";

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

export type StoryTrayItem = {
  user: UserSummaryView;
  hasUnseen: boolean;
  latestStoryAt: Date;
  storyCount: number;
};

export type StoryViewerView = { user: UserSummaryView; viewedAt: Date };

/** `GET /users/{username}/stories` read model. */
export type UserStoriesView = { user: UserSummaryView; stories: StoryItemView[] };
