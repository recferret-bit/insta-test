// Source: docs/specs/external-communication/05-stories-api.md.
import type { MediaId, StoryId } from "../ids.ts";
import type { Page } from "../pagination.ts";
import type { MediaResponseDto, UserSummaryDto } from "./common.ts";

export type CreateStoryRequestDto = { media_id: MediaId };

export type StoryResponseDto = {
  id: StoryId;
  author: UserSummaryDto;
  media: MediaResponseDto;
  created_at: string;
  expires_at: string;
  /** false when anonymous. */
  viewer_has_seen: boolean;
  /** Only for the author, else null. */
  view_count: number | null;
};

export type StoryTrayItemDto = {
  user: UserSummaryDto;
  has_unseen: boolean;
  latest_story_at: string;
  story_count: number;
};

export type StoryTrayResponseDto = { items: StoryTrayItemDto[] };

export type UserStoriesResponseDto = {
  user: UserSummaryDto;
  stories: StoryResponseDto[];
};

export type StoryViewerResponseDto = { user: UserSummaryDto; viewed_at: string };

export type StoryViewerPageResponseDto = Page<StoryViewerResponseDto>;
