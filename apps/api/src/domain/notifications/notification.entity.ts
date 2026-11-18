import { DomainError } from "../shared/errors.js";
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

/** Type-specific targets; the union makes invalid combinations a compile error for typed callers. */
export type NotificationTarget =
  | { type: "like"; postId: PostId; commentId?: null }
  | { type: "comment"; postId: PostId; commentId: CommentId }
  | { type: "follow"; postId?: null; commentId?: null };

export type CreateNotificationInput = {
  id: NotificationId;
  recipientId: UserId;
  actorId: UserId;
  now: Date;
} & NotificationTarget;

/** Programming error in the calling service (targets come from loaded entities, not from clients). */
function badTarget(message: string): never {
  throw new DomainError("INTERNAL", message);
}

/** Entity factory for `ENT-Notification`. */
export const Notification = {
  /**
   * Unread notification, or `null` for self-actions (`INV-08`). Throws `INTERNAL` when the
   * `postId`/`commentId` combination does not match `type`.
   */
  create(input: CreateNotificationInput): Notification | null {
    if (input.recipientId === input.actorId) return null;
    const postId = input.postId ?? null;
    const commentId = input.commentId ?? null;
    switch (input.type) {
      case "like":
        if (postId === null || commentId !== null)
          badTarget("like notification needs postId and no commentId");
        break;
      case "comment":
        if (postId === null || commentId === null)
          badTarget("comment notification needs postId and commentId");
        break;
      case "follow":
        if (postId !== null || commentId !== null) badTarget("follow notification has no postId/commentId");
        break;
      default:
        badTarget(`Unknown notification type '${String((input as { type: unknown }).type)}'`);
    }
    return {
      id: input.id,
      recipientId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      postId,
      commentId,
      createdAt: input.now,
      readAt: null,
    };
  },
};
