import { Notification } from "../notifications/notification.entity.js";
import type { NotificationRepository } from "../notifications/ports.js";
import type { Clock } from "../shared/clock.js";
import { DomainError } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { CommentId, NotificationId, PostId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { CreateCommentCommand } from "./commands.js";
import { Comment } from "./comment.entity.js";
import type { CommentRepository, PostRepository } from "./ports.js";
import type { CommentView } from "./views.js";

export type CommentServiceDeps = {
  comments: CommentRepository;
  posts: PostRepository;
  notifications: NotificationRepository;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
};

function postNotFound(): DomainError {
  return new DomainError("NOT_FOUND", "Post not found");
}

function commentNotFound(): DomainError {
  return new DomainError("NOT_FOUND", "Comment not found");
}

/** `F-BE-04` — comments (backend/02-services-and-use-cases.md#commentservice). */
export class CommentService {
  constructor(private readonly deps: CommentServiceDeps) {}

  /**
   * `NOT_FOUND`, `VALIDATION_FAILED`. In one tx: lock the live post, insert, `comment_count += 1`,
   * `comment` notification for the post author (not for self, `INV-08`).
   * Emits `CommentAdded`, `NotificationCreated` (if any), `PostCountersChanged`.
   */
  async addComment(cmd: CreateCommentCommand): Promise<CommentView> {
    const now = this.deps.clock.now();
    // Text validation first so invalid input never opens a transaction.
    const comment = Comment.create({
      id: this.deps.ids.uuidv7() as CommentId,
      postId: cmd.postId,
      authorId: cmd.authorId,
      text: cmd.text,
      now,
    });
    await this.deps.uow.run(async (tx, events) => {
      const post = await this.deps.posts.findLive(cmd.postId, tx);
      if (!post) throw postNotFound();
      await this.deps.comments.insert(comment, tx);
      const counters = await this.deps.posts.adjustCounters(post.id, { comments: 1 }, tx);
      events.add({
        type: "CommentAdded",
        commentId: comment.id,
        postId: post.id,
        authorId: comment.authorId,
        at: now,
      });
      const notification = Notification.create({
        id: this.deps.ids.uuidv7() as NotificationId,
        recipientId: post.authorId,
        actorId: comment.authorId,
        type: "comment",
        postId: post.id,
        commentId: comment.id,
        now,
      });
      if (notification && (await this.deps.notifications.insertIfAbsent(notification, tx))) {
        events.add({
          type: "NotificationCreated",
          notificationId: notification.id,
          recipientId: notification.recipientId,
        });
      }
      events.add({ type: "PostCountersChanged", postId: post.id, authorId: post.authorId, ...counters });
    });
    const view = await this.deps.comments.getView(comment.id);
    // A delete committed right after the insert surfaces as `NOT_FOUND`, like any later read.
    if (!view) throw commentNotFound();
    return view;
  }

  /**
   * `NOT_FOUND`, `FORBIDDEN` (`INV-10`: comment author or post author). In one tx: lock the comment, then its
   * live post; soft delete; `comment_count -= 1`. The `comment` notification is kept (hidden by the list query).
   * Emits `PostCountersChanged`.
   */
  async deleteComment(commentId: CommentId, actorId: UserId): Promise<void> {
    await this.deps.uow.run(async (tx, events) => {
      const comment = await this.deps.comments.findLive(commentId, tx);
      if (!comment) throw commentNotFound();
      // A comment on a soft-deleted post is no longer reachable through the API.
      const post = await this.deps.posts.findLive(comment.postId, tx);
      if (!post) throw commentNotFound();
      Comment.assertCanDelete(comment, actorId, post.authorId);
      await this.deps.comments.softDelete(comment.id, this.deps.clock.now(), tx);
      const counters = await this.deps.posts.adjustCounters(post.id, { comments: -1 }, tx);
      events.add({ type: "PostCountersChanged", postId: post.id, authorId: post.authorId, ...counters });
    });
  }

  /** Oldest first (`created_at ASC, id ASC`); `NOT_FOUND` for a missing/deleted post. */
  async listComments(postId: PostId, page: PageRequest<TimeCursor>): Promise<Page<CommentView, TimeCursor>> {
    if (!(await this.deps.posts.findLive(postId))) throw postNotFound();
    return this.deps.comments.listByPost(postId, page);
  }
}
