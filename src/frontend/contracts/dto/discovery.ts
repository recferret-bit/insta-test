// Source: docs/specs/external-communication/06-feed-search-notifications-api.md.
import type { CommentId, NotificationId, PostId } from "../ids.ts";
import type { Page } from "../pagination.ts";
import type { UserSummaryDto } from "./common.ts";
import type { PostResponseDto } from "./posts.ts";

export type UserSearchResponseDto = { items: UserSummaryDto[] };

export type HashtagResultDto = { tag: string; post_count: number };

export type HashtagSearchResponseDto = { items: HashtagResultDto[] };

export type HashtagPostsResponseDto = Page<PostResponseDto> & {
  tag: string;
  post_count: number;
};

export type NotificationType = "like" | "comment" | "follow";

export type NotificationResponseDto = {
  id: NotificationId;
  type: NotificationType;
  actor: UserSummaryDto;
  post_id: PostId | null;
  post_thumbnail_url: string | null;
  comment_id: CommentId | null;
  /** Truncated to 100 chars. */
  comment_text: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationPageResponseDto = Page<NotificationResponseDto>;

export type MarkNotificationsReadRequestDto = { up_to_id: NotificationId };

export type UnreadCountResponseDto = { unread_count: number };
