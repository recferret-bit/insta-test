import type { UserSummaryView } from "./identity.ts";
import type { CommentId, NotificationId, PostId, UserId } from "./shared/ids.ts";

/** ENT-Notification business entity (backend/01-business-entities.md#notification). */

export type NotificationType = "like" | "comment" | "follow";

export type Notification = {
  id: NotificationId;
  recipientId: UserId;
  actorId: UserId;
  type: NotificationType;
  postId: PostId | null; // like, comment
  commentId: CommentId | null; // comment
  createdAt: Date;
  readAt: Date | null;
};

export type NotificationView = Omit<Notification, "actorId" | "recipientId"> & {
  actor: UserSummaryView;
  postThumbnailStorageKey: string | null;
  commentText: string | null;
};

export type MarkReadCommand = { recipientId: UserId; upToId: NotificationId };

/**
 * Type/reference combination rule, mirrored by the `notifications_type_refs_check` DB constraint:
 * follow → no post/comment; like → post only; comment → post and comment.
 */
export function hasValidNotificationRefs(n: Pick<Notification, "type" | "postId" | "commentId">): boolean {
  switch (n.type) {
    case "follow":
      return n.postId === null && n.commentId === null;
    case "like":
      return n.postId !== null && n.commentId === null;
    case "comment":
      return n.postId !== null && n.commentId !== null;
  }
}
