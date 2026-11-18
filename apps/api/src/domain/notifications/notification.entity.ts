import type { CommentId, NotificationId, PostId, UserId } from "../shared/ids.js";

export const NOTIFICATION_TYPES = ["like", "comment", "follow"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * `like`: postId set, commentId null; `comment`: both set; `follow`: both null.
 * Never created when `recipientId === actorId` (`INV-08`).
 */
export type Notification = {
  id: NotificationId;
  recipientId: UserId;
  actorId: UserId;
  type: NotificationType;
  postId: PostId | null;
  commentId: CommentId | null;
  createdAt: Date;
  readAt: Date | null;
};

/** Key used to delete the notification when a like/follow is undone. */
export type NotificationUndoKey =
  | { type: "like"; actorId: UserId; postId: PostId }
  | { type: "follow"; actorId: UserId; recipientId: UserId };
