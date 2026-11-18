import type { UserRelationView } from "../identity/views.js";
import { Notification } from "../notifications/notification.entity.js";
import type { NotificationRepository } from "../notifications/ports.js";
import type { Clock } from "../shared/clock.js";
import { DomainError } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { NotificationId, PostId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { Tx, UnitOfWork } from "../shared/unit-of-work.js";
import { Like, type LikeState } from "./like.entity.js";
import type { Post } from "./post.entity.js";
import type { LikeRepository, PostRepository } from "./ports.js";

export type LikeServiceDeps = {
  likes: LikeRepository;
  posts: PostRepository;
  notifications: NotificationRepository;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
};

function postNotFound(): DomainError {
  return new DomainError("NOT_FOUND", "Post not found");
}

/** `F-BE-04` — likes (backend/02-services-and-use-cases.md#likeservice). */
export class LikeService {
  constructor(private readonly deps: LikeServiceDeps) {}

  /**
   * Idempotent. In one tx: lock the live post, insert-if-absent; only when a like was inserted:
   * `like_count += 1` and a `like` notification for the post author (not for self, `INV-08`).
   * Emits `PostLiked`, `NotificationCreated` (if any), `PostCountersChanged`.
   */
  async like(postId: PostId, userId: UserId): Promise<LikeState> {
    return this.deps.uow.run(async (tx, events) => {
      const post = await this.loadLive(postId, tx);
      const now = this.deps.clock.now();
      const inserted = await this.deps.likes.insertIfAbsent(Like.create({ postId, userId, now }), tx);
      if (!inserted) return { postId, liked: true, likeCount: post.likeCount };

      const counters = await this.deps.posts.adjustCounters(postId, { likes: 1 }, tx);
      events.add({ type: "PostLiked", postId, userId, at: now });
      const notification = Notification.create({
        id: this.deps.ids.uuidv7() as NotificationId,
        recipientId: post.authorId,
        actorId: userId,
        type: "like",
        postId,
        now,
      });
      if (notification && (await this.deps.notifications.insertIfAbsent(notification, tx))) {
        events.add({
          type: "NotificationCreated",
          notificationId: notification.id,
          recipientId: notification.recipientId,
        });
      }
      events.add({ type: "PostCountersChanged", postId, authorId: post.authorId, ...counters });
      return { postId, liked: true, likeCount: counters.likeCount };
    });
  }

  /**
   * Idempotent. In one tx: lock the live post, delete-if-present; only when a like was removed:
   * `like_count -= 1` and delete the matching `like` notification. Emits `PostCountersChanged`.
   */
  async unlike(postId: PostId, userId: UserId): Promise<LikeState> {
    return this.deps.uow.run(async (tx, events) => {
      const post = await this.loadLive(postId, tx);
      const deleted = await this.deps.likes.deleteIfPresent(postId, userId, tx);
      if (!deleted) return { postId, liked: false, likeCount: post.likeCount };

      const counters = await this.deps.posts.adjustCounters(postId, { likes: -1 }, tx);
      await this.deps.notifications.deleteFor({ type: "like", actorId: userId, postId }, tx);
      events.add({ type: "PostCountersChanged", postId, authorId: post.authorId, ...counters });
      return { postId, liked: false, likeCount: counters.likeCount };
    });
  }

  /** Likers, newest like first; `NOT_FOUND` for a missing/deleted post. */
  async listLikers(
    postId: PostId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>> {
    if (!(await this.deps.posts.findLive(postId))) throw postNotFound();
    return this.deps.likes.listLikers(postId, viewerId, page);
  }

  /** Live post, row-locked by the repository inside `tx` (serialises like/unlike/delete of the post). */
  private async loadLive(postId: PostId, tx: Tx): Promise<Post> {
    const post = await this.deps.posts.findLive(postId, tx);
    if (!post) throw postNotFound();
    return post;
  }
}
