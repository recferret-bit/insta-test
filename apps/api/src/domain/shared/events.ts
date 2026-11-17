import type { CommentId, NotificationId, PostId, UserId } from "./ids.js";

/**
 * In-process domain events (internal-communication/02-domain-events-and-sse.md#domain-events-in-process).
 * Collected inside a transaction and published by `UnitOfWork` only after `COMMIT`.
 */
export type PostCreated = { type: "PostCreated"; postId: PostId; authorId: UserId; at: Date };
export type PostDeleted = { type: "PostDeleted"; postId: PostId; authorId: UserId; at: Date };
export type PostLiked = { type: "PostLiked"; postId: PostId; userId: UserId; at: Date };
export type CommentAdded = {
  type: "CommentAdded";
  commentId: CommentId;
  postId: PostId;
  authorId: UserId;
  at: Date;
};
export type UserFollowed = { type: "UserFollowed"; followerId: UserId; followeeId: UserId; at: Date };
export type NotificationCreated = {
  type: "NotificationCreated";
  notificationId: NotificationId;
  recipientId: UserId;
};
export type NotificationsRead = { type: "NotificationsRead"; recipientId: UserId; unreadCount: number };
export type PostCountersChanged = {
  type: "PostCountersChanged";
  postId: PostId;
  authorId: UserId;
  likeCount: number;
  commentCount: number;
};

export type DomainEvent =
  | PostCreated
  | PostDeleted
  | PostLiked
  | CommentAdded
  | UserFollowed
  | NotificationCreated
  | NotificationsRead
  | PostCountersChanged;

export type DomainEventType = DomainEvent["type"];

/** Port implemented by `InProcessEventBus`; fan-out is async and isolated per handler. */
export interface DomainEventPublisher {
  publish(events: DomainEvent[]): void;
}

/** Tx-scoped collector handed to services by `UnitOfWork.run`; discarded on rollback. */
export interface EventCollector {
  add(...events: DomainEvent[]): void;
}

/** Simple array-backed collector used by `UnitOfWork` implementations and unit tests. */
export class BufferedEventCollector implements EventCollector {
  private readonly buffer: DomainEvent[] = [];

  add(...events: DomainEvent[]): void {
    this.buffer.push(...events);
  }

  /** Returns the collected events and empties the buffer. */
  drain(): DomainEvent[] {
    return this.buffer.splice(0, this.buffer.length);
  }
}
