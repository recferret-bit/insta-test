# 01 — Business Entities

All types live in `apps/api/src/domain/<module>/`. Entities are plain TypeScript objects created through factory functions that enforce invariants and throw `DomainError`. They are framework-free (`F-CORE-02`). Cross-layer field mapping is in [03-domain-and-entity-map.md](../specs/03-domain-and-entity-map.md).

## Shared Types (`domain/shared`)

```ts
type Brand<T, B> = T & { readonly __brand: B };
type UserId = Brand<string, "UserId">;          // canonical dashed UUID
type SessionId = Brand<string, "SessionId">;
type MediaId = Brand<string, "MediaId">;
type PostId = Brand<string, "PostId">;
type CommentId = Brand<string, "CommentId">;
type StoryId = Brand<string, "StoryId">;
type NotificationId = Brand<string, "NotificationId">;

class DomainError extends Error { constructor(readonly code: ErrorCode, message: string, readonly details?: unknown) }

interface Clock { now(): Date }
interface IdGenerator { uuidv7(): string }

type PageRequest<C> = { cursor: C | null; limit: number };
type Page<T, C> = { items: T[]; nextCursor: C | null };
type TimeCursor = { t: Date; id: string };
```

## User

```ts
type Username = Brand<string, "Username">;   // validated & lowercased
type Email = Brand<string, "Email">;          // validated & lowercased
type PasswordHash = Brand<string, "PasswordHash">;

type User = {
  id: UserId;
  username: Username;
  email: Email;
  passwordHash: PasswordHash;
  fullName: string;         // ≤ 60
  bio: string;              // ≤ 150, ≤ 4 newlines
  avatarMediaId: MediaId | null;
  stats: { posts: number; followers: number; following: number };
  createdAt: Date;
  updatedAt: Date;
};

// Read models
type UserSummaryView = {
  id: UserId; username: Username; fullName: string;
  avatarStorageKey: string | null;
  viewerIsFollowing: boolean | null;
};
type UserProfileView = UserSummaryView & {
  bio: string; stats: User["stats"]; hasActiveStory: boolean; createdAt: Date;
  email?: Email;            // only populated for the viewer's own profile
};
```

Invariants: `Username.parse` (regex + reserved list: `api`, `admin`, `explore`, `me`, `login`, `signup`, `settings`, `stories`, `p`, `u`, `media`, `notifications`, `create`), `Email.parse`, `User.updateProfile()` returns a new `User` with `updatedAt = clock.now()`.

## Session

```ts
type Session = {
  id: SessionId;
  userId: UserId;
  tokenHash: Buffer;        // sha256(rawToken)
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};
type IssuedSession = { session: Session; rawToken: string };   // rawToken exists only in memory for the response
```

`Session.isActive(now) = revokedAt === null && now < expiresAt`.

## MediaAsset

```ts
type MediaKind = "image" | "video";
type MediaPurpose = "post" | "story" | "avatar";
type MediaStatus = "uploaded" | "attached";

type MediaAsset = {
  id: MediaId;
  ownerId: UserId;
  purpose: MediaPurpose;
  kind: MediaKind;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm";
  storageKey: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  status: MediaStatus;
  createdAt: Date;
};
```

`MediaAsset.assertAttachable(asset, { ownerId, purpose, kind? })` throws `MEDIA_INVALID` unless owner matches, purpose matches, status is `uploaded`, and kind matches (avatar → image). `attach()` returns the asset with `status: "attached"`.

## Post

```ts
type Caption = Brand<string, "Caption">;       // trimmed, ≤ 2200
type Hashtag = Brand<string, "Hashtag">;       // lowercased, 1–64 [\p{L}\p{N}_]
type PostMediaItem = { mediaId: MediaId; position: number };   // 0..9

type Post = {
  id: PostId;
  authorId: UserId;
  caption: Caption;
  media: PostMediaItem[];   // 1..10, positions contiguous from 0
  hashtags: Hashtag[];      // derived: extractHashtags(caption), ≤ 30
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type PostView = {
  id: PostId;
  author: UserSummaryView;
  caption: Caption;
  media: MediaAsset[];      // ordered
  hashtags: Hashtag[];
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

`Post.create({ id, authorId, caption, mediaIds, now })` rejects 0 or > 10 media and duplicate IDs (`VALIDATION_FAILED`). `Post.editCaption(post, caption, now)` recomputes hashtags. `Post.assertCanModify(post, actorId)` → `FORBIDDEN`. More than 30 hashtags → `VALIDATION_FAILED`.

## Comment

```ts
type CommentText = Brand<string, "CommentText">;   // trimmed, 1–500
type Comment = { id: CommentId; postId: PostId; authorId: UserId; text: CommentText; createdAt: Date; deletedAt: Date | null };
type CommentView = { id: CommentId; postId: PostId; author: UserSummaryView; text: CommentText; createdAt: Date };
```

`Comment.assertCanDelete(comment, actorId, postAuthorId)` — allowed for comment author or post author (`INV-10`).

## Like

```ts
type Like = { postId: PostId; userId: UserId; createdAt: Date };
type LikeState = { postId: PostId; liked: boolean; likeCount: number };
```

## Follow

```ts
type Follow = { followerId: UserId; followeeId: UserId; createdAt: Date };
type FollowState = { followeeId: UserId; following: boolean; followersCount: number };
```

`Follow.create(followerId, followeeId, now)` → `CANNOT_FOLLOW_SELF` when equal (`INV-01`).

## Story

```ts
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
type Story = { id: StoryId; authorId: UserId; mediaId: MediaId; createdAt: Date; expiresAt: Date };

type StoryItemView = {
  id: StoryId; author: UserSummaryView; media: MediaAsset;
  createdAt: Date; expiresAt: Date;
  viewerHasSeen: boolean;
  viewCount: number | null;   // author only
};
type StoryTrayItem = { user: UserSummaryView; hasUnseen: boolean; latestStoryAt: Date; storyCount: number };
type StoryViewerView = { user: UserSummaryView; viewedAt: Date };
```

`Story.create({ id, authorId, mediaId, now })` sets `expiresAt = now + STORY_TTL_MS`. `Story.isActive(story, now) = now < expiresAt`.

## StorySeen

```ts
type StorySeen = { storyId: StoryId; viewerId: UserId; viewedAt: Date };
```

Not created when `viewerId === story.authorId`.

## Notification

```ts
type NotificationType = "like" | "comment" | "follow";
type Notification = {
  id: NotificationId;
  recipientId: UserId;
  actorId: UserId;
  type: NotificationType;
  postId: PostId | null;       // like, comment
  commentId: CommentId | null; // comment
  createdAt: Date;
  readAt: Date | null;
};
type NotificationView = Omit<Notification, "actorId" | "recipientId"> & {
  actor: UserSummaryView;
  postThumbnailStorageKey: string | null;
  commentText: string | null;
};
```

`Notification.create(...)` returns `null` when `recipientId === actorId` (`INV-08`) and validates the type/field combination.
