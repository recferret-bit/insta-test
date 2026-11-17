# 03 — Ports, Handlers & Jobs

## Port Interfaces (`domain/<module>/ports.ts`)

All repository methods accept an optional `tx: Tx` (opaque handle from `UnitOfWork`); without it they use the pool.

```ts
interface UnitOfWork { run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> }

interface UserRepository {
  insert(user: User, tx?: Tx): Promise<void>;                     // USERNAME_TAKEN / EMAIL_TAKEN on 23505
  update(user: User, tx?: Tx): Promise<void>;
  findById(id: UserId, tx?: Tx): Promise<User | null>;
  findByUsername(u: Username, tx?: Tx): Promise<User | null>;
  findByLogin(login: string, tx?: Tx): Promise<User | null>;     // username or email
  adjustCounters(id: UserId, delta: Partial<{ posts: number; followers: number; following: number }>, tx: Tx): Promise<void>;
  getProfileView(username: Username, viewerId: UserId | null): Promise<UserProfileView | null>;
}

interface SessionRepository {
  insert(s: Session, tx?: Tx): Promise<void>;
  findActiveByTokenHash(hash: Buffer, now: Date): Promise<Session | null>;
  revoke(id: SessionId, now: Date): Promise<void>;
}

interface MediaRepository {
  insert(m: MediaAsset): Promise<void>;
  findManyForUpdate(ids: MediaId[], tx: Tx): Promise<MediaAsset[]>;
  markAttached(ids: MediaId[], tx: Tx): Promise<void>;
  deleteUnattachedOlderThan(cutoff: Date, limit: number): Promise<MediaAsset[]>;   // returns deleted rows for file removal
}

interface MediaStorage {          // data/storage/local-media-storage.ts
  put(key: string, stream: Readable, maxBytes: number): Promise<{ byteSize: number }>;
  remove(key: string): Promise<void>;
}
interface MediaProbe {
  sniff(head: Buffer): { mime: MediaAsset["mimeType"]; kind: MediaKind } | null;
  imageSize(filePath: string): Promise<{ width: number; height: number }>;
}
interface PasswordHasher { hash(pw: string): Promise<PasswordHash>; verify(hash: PasswordHash, pw: string): Promise<boolean> }
interface TokenGenerator { generate(): { raw: string; hash: Buffer } }

interface PostRepository {
  insert(post: Post, tx: Tx): Promise<void>;                     // posts + post_media + post_hashtags
  findLive(id: PostId, tx?: Tx): Promise<Post | null>;
  updateCaption(post: Post, tx: Tx): Promise<void>;               // + replace hashtags
  softDelete(id: PostId, now: Date, tx: Tx): Promise<void>;
  adjustCounters(id: PostId, delta: Partial<{ likes: number; comments: number }>, tx: Tx): Promise<{ likeCount: number; commentCount: number }>;
  getView(id: PostId, viewerId: UserId | null): Promise<PostView | null>;
  listByAuthor(authorId: UserId, viewerId: UserId | null, page: PageRequest<TimeCursor>): Promise<Page<PostView, TimeCursor>>;
}

interface LikeRepository {
  insertIfAbsent(like: Like, tx: Tx): Promise<boolean>;
  deleteIfPresent(postId: PostId, userId: UserId, tx: Tx): Promise<boolean>;
  listLikers(postId: PostId, viewerId: UserId | null, page: PageRequest<TimeCursor>): Promise<Page<UserSummaryView & { relationAt: Date }, TimeCursor>>;
}

interface CommentRepository {
  insert(c: Comment, tx: Tx): Promise<void>;
  findLive(id: CommentId, tx?: Tx): Promise<Comment | null>;
  softDelete(id: CommentId, now: Date, tx: Tx): Promise<void>;
  getView(id: CommentId): Promise<CommentView | null>;
  listByPost(postId: PostId, page: PageRequest<TimeCursor>): Promise<Page<CommentView, TimeCursor>>;
}

interface FollowRepository {
  insertIfAbsent(f: Follow, tx: Tx): Promise<boolean>;
  deleteIfPresent(followerId: UserId, followeeId: UserId, tx: Tx): Promise<boolean>;
  listFollowers(userId: UserId, viewerId: UserId | null, page: PageRequest<TimeCursor>): Promise<Page<UserSummaryView & { relationAt: Date }, TimeCursor>>;
  listFollowing(userId: UserId, viewerId: UserId | null, page: PageRequest<TimeCursor>): Promise<Page<UserSummaryView & { relationAt: Date }, TimeCursor>>;
}

interface StoryRepository {
  insert(s: Story, tx: Tx): Promise<void>;
  findActive(id: StoryId, now: Date): Promise<Story | null>;
  deleteWithMedia(id: StoryId, tx: Tx): Promise<{ storageKey: string }>;   // deletes story + its media_assets row
  insertSeenIfAbsent(v: StorySeen): Promise<void>;
  tray(viewerId: UserId, now: Date): Promise<StoryTrayItem[]>;
  listActiveByAuthor(authorId: UserId, viewerId: UserId | null, now: Date): Promise<StoryItemView[]>;
  getView(id: StoryId, viewerId: UserId | null, now: Date): Promise<StoryItemView | null>;
  listViewers(id: StoryId, page: PageRequest<TimeCursor>): Promise<Page<StoryViewerView, TimeCursor>>;
  deleteExpiredBefore(cutoff: Date, limit: number): Promise<{ storyId: StoryId; storageKey: string }[]>;
}

interface NotificationRepository {
  insertIfAbsent(n: Notification, tx: Tx): Promise<boolean>;   // dedupe index for like/follow
  deleteFor(kind: { type: "like"; actorId: UserId; postId: PostId } | { type: "follow"; actorId: UserId; recipientId: UserId }, tx: Tx): Promise<void>;
  list(recipientId: UserId, page: PageRequest<TimeCursor>): Promise<Page<NotificationView, TimeCursor>>;
  getView(id: NotificationId): Promise<NotificationView | null>;
  unreadCount(recipientId: UserId): Promise<number>;
  markReadUpTo(recipientId: UserId, upToId: NotificationId, now: Date): Promise<void>;
}

interface FeedQueries {
  homeFeed(viewerId: UserId, page: PageRequest<TimeCursor>): Promise<Page<PostView, TimeCursor>>;
  explore(viewerId: UserId | null, page: PageRequest<TimeCursor>): Promise<Page<PostView, TimeCursor>>;
  byHashtag(tag: Hashtag, viewerId: UserId | null, page: PageRequest<TimeCursor>): Promise<Page<PostView, TimeCursor> & { postCount: number }>;
}

interface SearchQueries {
  users(q: string, viewerId: UserId | null, limit: number): Promise<UserSummaryView[]>;
  hashtags(prefix: string, limit: number): Promise<{ tag: Hashtag; postCount: number }[]>;
}

interface DomainEventPublisher { publish(events: DomainEvent[]): void }
```

Each service receives an `EventCollector` from `uow.run` (tx-scoped) and `UnitOfWork` publishes collected events via `DomainEventPublisher` after `COMMIT`.

## Handler Rules (`api/routes/*.routes.ts`)

Feature `F-BE-10`.

1. Declare the route with `schema: { body, params, querystring }` built from `@insta/contracts` (Zod → Fastify via `fastify-type-provider-zod`).
2. Declare `config: { auth: "required" | "optional" | "none", rateLimit? }`.
3. Body of the handler ≤ ~10 lines: `parsePublicId` path params → `map*DtoToCommand` → `await service.method()` → `map*ToResponseDto` → `reply.code(x).send(dto)`.
4. Handlers never catch `DomainError`; the central error handler maps it.
5. `PUBLIC_API_URL` needed for URLs is injected into DTO mappers via a `UrlBuilder` (`mediaUrl(storageKey)`), not read from env in mappers.

## Scheduled Jobs (`jobs/`)

Feature `F-BE-09`.

| Job | Interval | Behaviour |
|---|---|---|
| `StoryCleanupJob` | 10 min | `pg_try_advisory_lock(hashtext('story-cleanup'))`; delete stories with `expires_at < now()` in batches of 500; delete their media rows and files |
| `MediaCleanupJob` | 10 min | Advisory lock; delete `media_assets` with `status = 'uploaded'` and `created_at < now() - 24h` (batches of 500); remove files |

Jobs start after the HTTP server is listening, are skipped when `JOBS_ENABLED=false`, and log `{ job, deleted, durationMs }`. A failure is logged and retried on the next tick.
