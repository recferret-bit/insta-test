/** `StoryViewModel`, `StoryTrayItemViewModel` & story form mapper (frontend/02). Owned by w04 after w00. */
import type { StoryResponseDto, StoryTrayItemDto, StoryViewerResponseDto } from "@insta/contracts";

import type { CreateStoryBody } from "../../api/stories";
import { formatCount, formatRelativeTime, formatRemaining } from "./format";
import { toMediaVM, type MediaViewModel } from "./media";
import { toUserSummaryVM, type UserSummaryViewModel } from "./user";

/** Images show for 5 s; videos for their own duration. */
export const STORY_IMAGE_DURATION_MS = 5000;

export type StoryViewModel = {
  id: string;
  author: UserSummaryViewModel;
  media: MediaViewModel;
  createdAt: string;
  createdAtRelative: string;
  expiresAt: string;
  /** `"23h left"`. */
  remainingLabel: string;
  durationMs: number;
  viewerHasSeen: boolean;
  /** Author only, else `null`. */
  viewCount: number | null;
  /** `"Seen by 3"` for the author, else `null`. */
  viewCountLabel: string | null;
};

export type StoryTrayItemViewModel = {
  user: UserSummaryViewModel;
  ringState: "unseen" | "seen";
  latestStoryAt: string;
  storyCount: number;
  storyCountLabel: string;
  href: string;
};

export type StoryViewerViewModel = {
  user: UserSummaryViewModel;
  viewedAt: string;
  viewedAtRelative: string;
};

export function toStoryVM(dto: StoryResponseDto, now: Date = new Date()): StoryViewModel {
  const isVideo = dto.media.kind === "video";
  return {
    id: dto.id,
    author: toUserSummaryVM(dto.author),
    media: toMediaVM(dto.media),
    createdAt: dto.created_at,
    createdAtRelative: formatRelativeTime(dto.created_at, now),
    expiresAt: dto.expires_at,
    remainingLabel: formatRemaining(dto.expires_at, now),
    durationMs: isVideo && dto.media.duration_ms ? dto.media.duration_ms : STORY_IMAGE_DURATION_MS,
    viewerHasSeen: dto.viewer_has_seen,
    viewCount: dto.view_count,
    viewCountLabel: dto.view_count === null ? null : `Seen by ${dto.view_count}`,
  };
}

export function toStoryTrayItemVM(dto: StoryTrayItemDto): StoryTrayItemViewModel {
  return {
    user: toUserSummaryVM(dto.user),
    ringState: dto.has_unseen ? "unseen" : "seen",
    latestStoryAt: dto.latest_story_at,
    storyCount: dto.story_count,
    storyCountLabel: formatCount(dto.story_count, "story", "stories"),
    href: `/stories/${encodeURIComponent(dto.user.username)}`,
  };
}

export function toStoryViewerVM(dto: StoryViewerResponseDto, now: Date = new Date()): StoryViewerViewModel {
  return {
    user: toUserSummaryVM(dto.user),
    viewedAt: dto.viewed_at,
    viewedAtRelative: formatRelativeTime(dto.viewed_at, now),
  };
}

export function toCreateStoryDto(mediaId: string): CreateStoryBody {
  return { media_id: mediaId };
}
