import type { UserRelationView } from "../../../src/domain/identity/views.js";
import type { Username } from "../../../src/domain/identity/user.entity.js";
import type {
  Notification,
  NotificationUndoKey,
} from "../../../src/domain/notifications/notification.entity.js";
import type { NotificationRepository } from "../../../src/domain/notifications/ports.js";
import type { NotificationView } from "../../../src/domain/notifications/views.js";
import type { Comment } from "../../../src/domain/posts/comment.entity.js";
import type { Like } from "../../../src/domain/posts/like.entity.js";
import { Post } from "../../../src/domain/posts/post.entity.js";
import type { CommentRepository, LikeRepository } from "../../../src/domain/posts/ports.js";
import type { CommentView } from "../../../src/domain/posts/views.js";
import type { CommentId, MediaId, NotificationId, PostId, UserId } from "../../../src/domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../../src/domain/shared/pagination.js";
import type { Tx } from "../../../src/domain/shared/unit-of-work.js";

const summary = (id: UserId) => ({
  id,
  username: `u_${id.slice(-4)}` as Username,
  fullName: "",
  avatarStorageKey: null,
  viewerIsFollowing: null,
});

/** In-memory `LikeRepository` keyed `${postId}:${userId}`. */
export class FakeLikes implements LikeRepository {
  rows = new Map<string, Like>();
  listCalls: { postId: PostId; viewerId: UserId | null; page: PageRequest<TimeCursor> }[] = [];

  async insertIfAbsent(like: Like, _tx: Tx): Promise<boolean> {
    const key = `${like.postId}:${like.userId}`;
    if (this.rows.has(key)) return false;
    this.rows.set(key, { ...like });
    return true;
  }

  async deleteIfPresent(postId: PostId, userId: UserId, _tx: Tx): Promise<boolean> {
    return this.rows.delete(`${postId}:${userId}`);
  }

  async listLikers(
    postId: PostId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>> {
    this.listCalls.push({ postId, viewerId, page });
    const items = [...this.rows.values()]
      .filter((l) => l.postId === postId)
      .map((l) => ({ ...summary(l.userId), relationAt: l.createdAt }));
    return { items, nextCursor: null };
  }
}

/** In-memory `CommentRepository`; `findLiveTx` records whether lookups ran inside a tx. */
export class FakeComments implements CommentRepository {
  rows = new Map<CommentId, Comment>();
  findLiveTx: (Tx | undefined)[] = [];
  listCalls: { postId: PostId; page: PageRequest<TimeCursor> }[] = [];

  async insert(c: Comment, _tx: Tx): Promise<void> {
    this.rows.set(c.id, { ...c });
  }

  async findLive(id: CommentId, tx?: Tx): Promise<Comment | null> {
    this.findLiveTx.push(tx);
    const c = this.rows.get(id);
    return c && c.deletedAt === null ? { ...c } : null;
  }

  async softDelete(id: CommentId, now: Date, _tx: Tx): Promise<void> {
    const c = this.rows.get(id);
    if (c && c.deletedAt === null) this.rows.set(id, { ...c, deletedAt: now });
  }

  async getView(id: CommentId): Promise<CommentView | null> {
    const c = this.rows.get(id);
    return c && c.deletedAt === null ? toView(c) : null;
  }

  async listByPost(postId: PostId, page: PageRequest<TimeCursor>): Promise<Page<CommentView, TimeCursor>> {
    this.listCalls.push({ postId, page });
    const items = [...this.rows.values()]
      .filter((c) => c.postId === postId && c.deletedAt === null)
      .map(toView);
    return { items, nextCursor: null };
  }
}

function toView(c: Comment): CommentView {
  return { id: c.id, postId: c.postId, author: summary(c.authorId), text: c.text, createdAt: c.createdAt };
}

/** In-memory `NotificationRepository` (writes only; like dedupe like `notifications_like_uq`). */
export class FakeNotifications implements NotificationRepository {
  rows = new Map<NotificationId, Notification>();

  async insertIfAbsent(n: Notification, _tx: Tx): Promise<boolean> {
    const dup = [...this.rows.values()].some(
      (x) =>
        n.type === "like" &&
        x.type === "like" &&
        x.recipientId === n.recipientId &&
        x.actorId === n.actorId &&
        x.postId === n.postId,
    );
    if (dup) return false;
    this.rows.set(n.id, { ...n });
    return true;
  }

  async deleteFor(kind: NotificationUndoKey, _tx: Tx): Promise<void> {
    for (const [id, n] of this.rows) {
      if (kind.type === "like" && n.type === "like" && n.actorId === kind.actorId && n.postId === kind.postId)
        this.rows.delete(id);
    }
  }

  async list(): Promise<Page<NotificationView, TimeCursor>> {
    throw new Error("not used");
  }
  async getView(): Promise<NotificationView | null> {
    throw new Error("not used");
  }
  async unreadCount(): Promise<number> {
    throw new Error("not used");
  }
  async markReadUpTo(): Promise<void> {
    throw new Error("not used");
  }
}

/** A live post by `authorId` with the given counters. */
export function samplePost(
  id: PostId,
  authorId: UserId,
  counters: { likes?: number; comments?: number } = {},
) {
  const post = Post.create({
    id,
    authorId,
    caption: "",
    mediaIds: [`${id.slice(0, -4)}9999` as MediaId],
    now: new Date("2026-11-17T09:00:00.000Z"),
  });
  return { ...post, likeCount: counters.likes ?? 0, commentCount: counters.comments ?? 0 };
}
