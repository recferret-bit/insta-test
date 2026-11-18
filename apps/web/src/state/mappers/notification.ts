/** `NotificationViewModel` & mark-read mapper (frontend/02). Owned by w06 after w00. */
import type { NotificationResponseDto } from "@insta/contracts";

import type { MarkNotificationsReadBody } from "../../api/notifications";
import { formatFullDate, formatRelativeTime } from "./format";
import { toUserSummaryVM, type UserSummaryViewModel } from "./user";

export type NotificationViewModel = {
  id: string;
  type: "like" | "comment" | "follow";
  actor: UserSummaryViewModel;
  /** Text after the actor's username: `"liked your post"`, `"commented: …"`, `"started following you"`. */
  message: string;
  /** Post page for like/comment, actor profile for follow. */
  href: string;
  postThumbnailUrl: string | null;
  isUnread: boolean;
  createdAt: string;
  createdAtRelative: string;
  createdAtTitle: string;
};

function messageFor(dto: NotificationResponseDto): string {
  switch (dto.type) {
    case "like":
      return "liked your post";
    case "comment":
      return dto.comment_text ? `commented: ${dto.comment_text}` : "commented on your post";
    case "follow":
      return "started following you";
  }
}

export function toNotificationVM(
  dto: NotificationResponseDto,
  now: Date = new Date(),
): NotificationViewModel {
  const actor = toUserSummaryVM(dto.actor);
  return {
    id: dto.id,
    type: dto.type,
    actor,
    message: messageFor(dto),
    href: dto.type !== "follow" && dto.post_id ? `/p/${encodeURIComponent(dto.post_id)}` : actor.profilePath,
    postThumbnailUrl: dto.post_thumbnail_url,
    isUnread: dto.read_at === null,
    createdAt: dto.created_at,
    createdAtRelative: formatRelativeTime(dto.created_at, now),
    createdAtTitle: formatFullDate(dto.created_at),
  };
}

/** Marks the newest notification (and everything older) read. */
export function toMarkReadDto(newestNotificationId: string): MarkNotificationsReadBody {
  return { up_to_id: newestNotificationId };
}
