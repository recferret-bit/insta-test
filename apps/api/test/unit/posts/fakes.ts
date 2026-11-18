import type { User, Username } from "../../../src/domain/identity/user.entity.js";
import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import type { Post } from "../../../src/domain/posts/post.entity.js";
import type { PostCounterDelta, PostRepository } from "../../../src/domain/posts/ports.js";
import type { PostView } from "../../../src/domain/posts/views.js";
import type { MediaId, PostId, UserId } from "../../../src/domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../../src/domain/shared/pagination.js";
import { BufferedEventCollector, type DomainEvent } from "../../../src/domain/shared/events.js";
import type { Tx, UnitOfWork } from "../../../src/domain/shared/unit-of-work.js";

/** In-memory `PostRepository` for `PostService` unit tests; views are built from the stored aggregate. */
export class FakePosts implements PostRepository {
  rows = new Map<PostId, Post>();
  /** Media assets known to the view builder (shared with `FakeMedia`). */
  constructor(private readonly media: { rows: Map<MediaId, MediaAsset> }) {}
  likedBy = new Set<string>();
  findLiveTx: (Tx | undefined)[] = [];
  listCalls: { authorId: UserId; viewerId: UserId | null; page: PageRequest<TimeCursor> }[] = [];

  async insert(post: Post): Promise<void> {
    this.rows.set(post.id, structuredClone(post));
  }

  async findLive(id: PostId, tx?: Tx): Promise<Post | null> {
    this.findLiveTx.push(tx);
    const post = this.rows.get(id);
    return post && post.deletedAt === null ? structuredClone(post) : null;
  }

  async updateCaption(post: Post): Promise<void> {
    const cur = this.rows.get(post.id);
    if (cur)
      this.rows.set(post.id, {
        ...cur,
        caption: post.caption,
        hashtags: [...post.hashtags],
        updatedAt: post.updatedAt,
      });
  }

  async softDelete(id: PostId, now: Date): Promise<void> {
    const cur = this.rows.get(id);
    if (cur && cur.deletedAt === null) this.rows.set(id, { ...cur, deletedAt: now });
  }

  async adjustCounters(
    id: PostId,
    delta: PostCounterDelta,
  ): Promise<{ likeCount: number; commentCount: number }> {
    const cur = this.rows.get(id)!;
    cur.likeCount += delta.likes ?? 0;
    cur.commentCount += delta.comments ?? 0;
    return { likeCount: cur.likeCount, commentCount: cur.commentCount };
  }

  async getView(id: PostId, viewerId: UserId | null): Promise<PostView | null> {
    const post = this.rows.get(id);
    return post && post.deletedAt === null ? this.toView(post, viewerId) : null;
  }

  async listByAuthor(
    authorId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<PostView, TimeCursor>> {
    this.listCalls.push({ authorId, viewerId, page });
    const items = [...this.rows.values()]
      .filter((p) => p.authorId === authorId && p.deletedAt === null)
      .map((p) => this.toView(p, viewerId));
    return { items, nextCursor: null };
  }

  private toView(post: Post, viewerId: UserId | null): PostView {
    return {
      id: post.id,
      author: {
        id: post.authorId,
        username: `u_${post.authorId.slice(-4)}` as Username,
        fullName: "",
        avatarStorageKey: null,
        viewerIsFollowing: null,
      },
      caption: post.caption,
      media: post.media.map((m) => this.media.rows.get(m.mediaId)!),
      hashtags: [...post.hashtags],
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      viewerHasLiked: viewerId !== null && this.likedBy.has(`${viewerId}:${post.id}`),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}

/**
 * Snapshot/restore `UnitOfWork` (emulates ROLLBACK on the given stores) that records the events
 * published after a successful run, like `PgUnitOfWork`.
 */
export class RecordingUow implements UnitOfWork {
  published: DomainEvent[] = [];
  runs = 0;
  constructor(private readonly stores: { rows: Map<unknown, unknown> }[]) {}

  async run<T>(fn: (tx: Tx, events: BufferedEventCollector) => Promise<T>): Promise<T> {
    this.runs += 1;
    const snapshots = this.stores.map((s) => new Map([...s.rows].map(([k, v]) => [k, structuredClone(v)])));
    const collector = new BufferedEventCollector();
    try {
      const result = await fn({ fake: this.runs } as unknown as Tx, collector);
      this.published.push(...collector.drain());
      return result;
    } catch (err) {
      this.stores.forEach((s, i) => {
        s.rows = snapshots[i]!;
      });
      throw err;
    }
  }
}

export function sampleUser(id: UserId, username: string): User {
  const at = new Date("2026-11-01T00:00:00.000Z");
  return {
    id,
    username: username as Username,
    email: `${username}@example.test` as User["email"],
    passwordHash: "h" as User["passwordHash"],
    fullName: "",
    bio: "",
    avatarMediaId: null,
    stats: { posts: 0, followers: 0, following: 0 },
    createdAt: at,
    updatedAt: at,
  };
}

export function sampleMedia(id: MediaId, ownerId: UserId, overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id,
    ownerId,
    purpose: "post",
    kind: "image",
    mimeType: "image/jpeg",
    storageKey: `2026/11/${id}.jpg`,
    byteSize: 2048,
    width: 1080,
    height: 1080,
    durationMs: null,
    status: "uploaded",
    createdAt: new Date("2026-11-17T09:00:00.000Z"),
    ...overrides,
  };
}
