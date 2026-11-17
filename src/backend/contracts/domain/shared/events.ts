import type { CommentId, NotificationId, PostId, UserId } from "./ids.ts";

/** In-process domain events (internal-communication/02). Published only after COMMIT. */
export type DomainEvent =
  | { type: "PostCreated"; postId: PostId; authorId: UserId; at: Date }
  | { type: "PostDeleted"; postId: PostId; authorId: UserId; at: Date }
  | { type: "PostLiked"; postId: PostId; userId: UserId; at: Date }
  | { type: "CommentAdded"; commentId: CommentId; postId: PostId; authorId: UserId; at: Date }
  | { type: "UserFollowed"; followerId: UserId; followeeId: UserId; at: Date }
  | { type: "NotificationCreated"; notificationId: NotificationId; recipientId: UserId }
  | { type: "NotificationsRead"; recipientId: UserId; unreadCount: number }
  | { type: "PostCountersChanged"; postId: PostId; authorId: UserId; likeCount: number; commentCount: number };

export type DomainEventType = DomainEvent["type"];

/** Collects events during a unit of work; discarded on rollback. */
export interface EventCollector {
  add(event: DomainEvent): void;
}

export interface DomainEventPublisher {
  publish(events: readonly DomainEvent[]): void;
}
