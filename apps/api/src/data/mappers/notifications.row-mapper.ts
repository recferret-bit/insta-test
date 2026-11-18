import type { Notification } from "../../domain/notifications/notification.entity.js";
import type { NotificationView } from "../../domain/notifications/views.js";
import type { CommentId, NotificationId, PostId, UserId } from "../../domain/shared/ids.js";
import { DOMAIN_LIMITS } from "../../domain/shared/limits.js";
import type { NotificationRow, NotificationViewRow } from "../rows/notifications.row.js";
import { mapUserSummaryViewRow } from "./users.row-mapper.js";

/** `ENT-Notification` Row → Business Entity (persistence/03-row-mappers.md#mapper-catalog). */
export function mapNotificationRowToEntity(row: NotificationRow): Notification {
  return {
    id: row.id as NotificationId,
    recipientId: row.recipient_id as UserId,
    actorId: row.actor_id as UserId,
    type: row.type,
    postId: row.post_id as PostId | null,
    commentId: row.comment_id as CommentId | null,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

/** `ENT-Notification` Business Entity → Row. */
export function mapNotificationEntityToRow(n: Notification): NotificationRow {
  return {
    id: n.id,
    recipient_id: n.recipientId,
    actor_id: n.actorId,
    type: n.type,
    post_id: n.postId,
    comment_id: n.commentId,
    created_at: n.createdAt,
    read_at: n.readAt,
  };
}

function truncateCommentText(text: string | null): string | null {
  if (text === null) return null;
  const chars = Array.from(text);
  const max = DOMAIN_LIMITS.notificationCommentTextMax;
  return chars.length <= max ? text : chars.slice(0, max).join("");
}

/** Notification list/SSE query row → `NotificationView` (`actor_*` summary, thumbnail key, comment text ≤ 100). */
export function mapNotificationViewRow(row: NotificationViewRow): NotificationView {
  const { actorId: _actorId, recipientId: _recipientId, ...base } = mapNotificationRowToEntity(row);
  return {
    ...base,
    actor: mapUserSummaryViewRow(row, "actor_"),
    postThumbnailStorageKey: row.post_thumbnail_storage_key,
    commentText: truncateCommentText(row.comment_text),
  };
}
