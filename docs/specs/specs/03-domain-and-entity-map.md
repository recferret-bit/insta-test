# 03 — Master Domain & Cross-Layer Entity Map

Feature: `F-CORE-03` (three-layer entity mapping), `F-CORE-04` (public prefixed IDs).

Every persistent or externally exposed concept has three distinct representations:

1. **API Request/Response DTO** — wire JSON, `snake_case`, public prefixed IDs, ISO-8601 UTC strings. Schemas in `packages/contracts/src/dto/*.ts`; endpoint docs in [external-communication/](../external-communication/README.md).
2. **Business Entity** — `camelCase` TypeScript class/record in `apps/api/src/domain/**`, branded ID types, `Date` instants, invariants enforced by factories. Details in [backend/01-business-entities.md](../backend/01-business-entities.md).
3. **Database Entity** — `<Name>Row` type mirroring a PostgreSQL row (`snake_case`, `uuid`, `timestamptz`). Details in [persistence/01-schema.md](../persistence/01-schema.md).

Raw rows are never returned to HTTP; raw request bodies are never passed to repositories.

## Shared Transformation Rules

| Rule | DTO | Business | DB |
|---|---|---|---|
| IDs | `"<prefix>_<32 lowercase hex>"`, e.g. `usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f` | branded `string` UUID (`UserId`, …) in canonical dashed form | `uuid` |
| ID conversion | `toPublicId(prefix, uuid)` strips dashes and prepends prefix; `parsePublicId(prefix, s)` validates regex `^<prefix>_[0-9a-f]{32}$` and re-inserts dashes; mismatch → `400 VALIDATION_FAILED` | — | — |
| Timestamps | ISO-8601 UTC string with `Z` and milliseconds | `Date` | `timestamptz` |
| Optional values | `null` (key always present in responses) | `null` | `NULL` |
| Media URL | `url: string` = `${PUBLIC_API_URL}/media/${storage_key}` | `storageKey: string` | `storage_key text` |
| Viewer-dependent flags | `viewer_has_liked`, `is_following`, `viewer_has_seen` | computed in read models | not stored; computed via `EXISTS` subquery |

ID prefixes: `usr` (User), `ses` (Session), `med` (Media), `pst` (Post), `cmt` (Comment), `sty` (Story), `ntf` (Notification). Like, Follow, and StoryView use composite keys and have no public ID.

UUIDs are generated in the application as UUIDv7 (time-ordered) by the `IdGenerator` port.

---

## ENT-User

- **Summary:** A registered account with a public profile.
- **API DTOs:** `SignupRequestDto`, `UpdateProfileRequestDto`, `MeResponseDto`, `UserProfileResponseDto`, `UserSummaryDto` ([02-auth-and-users-api.md](../external-communication/02-auth-and-users-api.md))
- **Business Entity:** `User` + read model `UserProfileView` ([backend/01-business-entities.md](../backend/01-business-entities.md#user))
- **Database Entity:** `users` table / `UserRow` ([persistence/01-schema.md](../persistence/01-schema.md#users))
- **Mappers:** `mapSignupDtoToCommand`, `mapUpdateProfileDtoToCommand`, `mapUserToMeResponseDto`, `mapUserProfileViewToResponseDto`, `mapUserToSummaryDto`, `mapUserRowToEntity`, `mapUserEntityToRow`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`users`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Identifier | `id: string` (`usr_…`, res only) | `id: UserId` | `id uuid PK` | UUIDv7; omitted on requests |
| Username | `username: string` (req signup, res) | `username: Username` | `username text NOT NULL UNIQUE` | Trimmed, lowercased; `^[a-z0-9._]{3,30}$`, not starting/ending with `.`; reserved names (`explore`, `api`, `me`, …) rejected |
| Email | `email: string` (req signup; res only in `MeResponseDto`) | `email: Email` | `email text NOT NULL UNIQUE` | Lowercased; RFC-5322-lite; never exposed on other users |
| Password | `password: string` (req only, 8–128 chars) | `passwordHash: PasswordHash` | `password_hash text NOT NULL` | argon2id hash; plaintext never stored, logged, or returned |
| Full name | `full_name: string` | `fullName: string` | `full_name text NOT NULL DEFAULT ''` | Trimmed; 0–60 chars |
| Bio | `bio: string` | `bio: string` | `bio text NOT NULL DEFAULT ''` | 0–150 chars; newlines allowed (max 4) |
| Avatar | req: `avatar_media_id: string \| null` (`med_…`); res: `avatar_url: string \| null` | `avatarMediaId: MediaId \| null` (+ `avatarStorageKey` in views) | `avatar_media_id uuid NULL FK → media_assets(id) ON DELETE SET NULL` | Media must be owned by the user, kind `image`, purpose `avatar` |
| Posts count | `posts_count: number` (res) | `stats.posts: number` | `posts_count integer NOT NULL DEFAULT 0 CHECK (>= 0)` | Maintained transactionally by `PostService` |
| Followers count | `followers_count: number` (res) | `stats.followers: number` | `followers_count integer NOT NULL DEFAULT 0 CHECK (>= 0)` | Maintained by `FollowService` |
| Following count | `following_count: number` (res) | `stats.following: number` | `following_count integer NOT NULL DEFAULT 0 CHECK (>= 0)` | Maintained by `FollowService` |
| Viewer follows | `is_following: boolean \| null` (res) | `UserProfileView.viewerIsFollowing` | — (computed `EXISTS` on `follows`) | `null` when anonymous or viewing self |
| Active story | `has_active_story: boolean` (res, profile only) | `UserProfileView.hasActiveStory` | — (computed `EXISTS` on `stories` where `expires_at > now()`) | Drives the story ring on the profile avatar |
| Created | `created_at: string` (res) | `createdAt: Date` | `created_at timestamptz NOT NULL DEFAULT now()` | ISO ↔ Date |
| Updated | — | `updatedAt: Date` | `updated_at timestamptz NOT NULL DEFAULT now()` | Set on every profile update |

## ENT-Session

- **Summary:** An authenticated login session represented by an opaque bearer token.
- **API DTOs:** `LoginRequestDto`, `SignupRequestDto` (shares response), `AuthTokenResponseDto`, `SseTicketResponseDto` ([02-auth-and-users-api.md](../external-communication/02-auth-and-users-api.md))
- **Business Entity:** `Session` ([backend/01-business-entities.md](../backend/01-business-entities.md#session))
- **Database Entity:** `sessions` table / `SessionRow` ([persistence/01-schema.md](../persistence/01-schema.md#sessions))
- **Mappers:** `mapLoginDtoToCommand`, `mapSessionToAuthTokenDto`, `mapSessionRowToEntity`, `mapSessionEntityToRow`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`sessions`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Identifier | — (not exposed) | `id: SessionId` | `id uuid PK` | UUIDv7 |
| Login handle | `login: string` (req) | `LoginCommand.login` | — | Matched against `username` or `email` (lowercased) |
| Password | `password: string` (req) | `LoginCommand.password` | — | Verified with argon2id against `users.password_hash` |
| Token | `access_token: string` (res only, once) | `tokenHash: Buffer` (raw token only in `IssuedSession`) | `token_hash bytea NOT NULL UNIQUE` | 32 random bytes → base64url (43 chars) on wire; SHA-256 stored |
| Token type | `token_type: "Bearer"` (res) | — | — | Constant |
| Owner | `user: MeResponseDto` (res) | `userId: UserId` | `user_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | — |
| Expiry | `expires_at: string` (res) | `expiresAt: Date` | `expires_at timestamptz NOT NULL` | `createdAt + SESSION_TTL_DAYS` (default 30) |
| Revocation | — | `revokedAt: Date \| null` | `revoked_at timestamptz NULL` | Set by logout; revoked/expired sessions → `401 UNAUTHENTICATED` |
| Client info | — | `userAgent: string` | `user_agent text NOT NULL DEFAULT ''` | Truncated to 255 chars |
| Created | — | `createdAt: Date` | `created_at timestamptz NOT NULL DEFAULT now()` | — |

## ENT-Media

- **Summary:** An uploaded image or video file, later attached to a post, story, or avatar.
- **API DTOs:** `UploadMediaRequest` (multipart form), `MediaResponseDto` ([03-media-and-posts-api.md](../external-communication/03-media-and-posts-api.md))
- **Business Entity:** `MediaAsset` ([backend/01-business-entities.md](../backend/01-business-entities.md#mediaasset))
- **Database Entity:** `media_assets` table / `MediaAssetRow` ([persistence/01-schema.md](../persistence/01-schema.md#media_assets))
- **Mappers:** `mapUploadMultipartToCommand`, `mapMediaToResponseDto`, `mapMediaRowToEntity`, `mapMediaEntityToRow`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`media_assets`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Identifier | `id: string` (`med_…`, res) | `id: MediaId` | `id uuid PK` | UUIDv7 |
| Owner | — | `ownerId: UserId` | `owner_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | From `AuthContext` |
| Purpose | `purpose: "post" \| "story" \| "avatar"` (req form field, res) | `purpose: MediaPurpose` | `purpose text NOT NULL CHECK (purpose IN ('post','story','avatar'))` | Avatar must be image |
| Kind | `kind: "image" \| "video"` (res) | `kind: MediaKind` | `kind text NOT NULL CHECK (kind IN ('image','video'))` | Derived from sniffed MIME type |
| MIME type | `mime_type: string` (res) | `mimeType: string` | `mime_type text NOT NULL` | Allowed: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/webm`; sniffed from magic bytes, not trusted from client |
| File | `file` (req multipart part) | `MediaUploadCommand.stream` | — | Image ≤ 10 MiB, video ≤ 50 MiB |
| Storage location | `url: string` (res) | `storageKey: string` | `storage_key text NOT NULL UNIQUE` | Key `<yyyy>/<mm>/<uuid>.<ext>`; url = `${PUBLIC_API_URL}/media/${storage_key}` |
| Size | `size_bytes: number` (res) | `byteSize: number` | `byte_size bigint NOT NULL CHECK (byte_size > 0)` | — |
| Dimensions | `width: number \| null`, `height: number \| null` (req for video optional, res) | `width/height: number \| null` | `width integer NULL`, `height integer NULL` | Images: probed server-side; videos: client-supplied, 1–8192 |
| Duration | `duration_ms: number \| null` (req for video optional, res) | `durationMs: number \| null` | `duration_ms integer NULL CHECK (duration_ms BETWEEN 1 AND 60000)` | Videos only; ≤ 60 s |
| Attachment state | — | `status: "uploaded" \| "attached"` | `status text NOT NULL DEFAULT 'uploaded' CHECK (...)` | Becomes `attached` when used by a post/story/avatar; an attached asset cannot be attached again |
| Created | `created_at: string` (res) | `createdAt: Date` | `created_at timestamptz NOT NULL DEFAULT now()` | Unattached assets older than 24 h are purged by `MediaCleanupJob` |

## ENT-Post

- **Summary:** A published post with 1–10 ordered media items, a caption, and derived hashtags.
- **API DTOs:** `CreatePostRequestDto`, `UpdatePostRequestDto`, `PostResponseDto`, `PostPageResponseDto` ([03-media-and-posts-api.md](../external-communication/03-media-and-posts-api.md))
- **Business Entity:** `Post` (aggregate incl. `PostMediaItem[]`, `Hashtag[]`) + read model `PostView` ([backend/01-business-entities.md](../backend/01-business-entities.md#post))
- **Database Entity:** `posts`, `post_media`, `post_hashtags` tables / `PostRow`, `PostMediaRow`, `PostHashtagRow` ([persistence/01-schema.md](../persistence/01-schema.md#posts))
- **Mappers:** `mapCreatePostDtoToCommand`, `mapUpdatePostDtoToCommand`, `mapPostViewToResponseDto`, `mapPostRowsToEntity`, `mapPostEntityToRows`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`posts` / `post_media` / `post_hashtags`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Identifier | `id: string` (`pst_…`, res) | `id: PostId` | `posts.id uuid PK` | UUIDv7 |
| Author | `author: UserSummaryDto` (res) | `authorId: UserId` (view: `author: UserSummaryView`) | `posts.author_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | From `AuthContext` on create |
| Caption | `caption: string` (req create/update, res) | `caption: Caption` | `posts.caption text NOT NULL DEFAULT ''` | 0–2200 chars, trimmed; max 30 hashtags |
| Media items | req: `media_ids: string[]` (1–10, `med_…`); res: `media: MediaResponseDto[]` | `media: PostMediaItem[]` (`{ mediaId, position }`) | `post_media(post_id uuid FK, media_id uuid FK UNIQUE, position smallint CHECK 0..9)`, PK `(post_id, position)` | Array order = `position`; each media owned by author, purpose `post`, status `uploaded`; immutable after create |
| Hashtags | `hashtags: string[]` (res) | `hashtags: Hashtag[]` | `post_hashtags(post_id uuid FK, tag text)`, PK `(post_id, tag)` | Extracted from caption by regex `#([\p{L}\p{N}_]{1,64})`, lowercased, deduplicated; recomputed on caption update |
| Like count | `like_count: number` (res) | `likeCount: number` | `posts.like_count integer NOT NULL DEFAULT 0 CHECK (>= 0)` | Maintained by `LikeService` |
| Comment count | `comment_count: number` (res) | `commentCount: number` | `posts.comment_count integer NOT NULL DEFAULT 0 CHECK (>= 0)` | Maintained by `CommentService` |
| Viewer liked | `viewer_has_liked: boolean` (res) | `PostView.viewerHasLiked` | — (computed `EXISTS` on `post_likes`) | `false` when anonymous |
| Created | `created_at: string` (res) | `createdAt: Date` | `posts.created_at timestamptz NOT NULL DEFAULT now()` | Feed ordering key with `id` |
| Updated | `updated_at: string` (res) | `updatedAt: Date` | `posts.updated_at timestamptz NOT NULL DEFAULT now()` | Changes on caption edit |
| Deletion | — (deleted posts → 404) | `deletedAt: Date \| null` | `posts.deleted_at timestamptz NULL` | Soft delete; excluded from every read; decrements author `posts_count` |

## ENT-Comment

- **Summary:** A flat text comment on a post.
- **API DTOs:** `CreateCommentRequestDto`, `CommentResponseDto`, `CommentPageResponseDto` ([04-social-api.md](../external-communication/04-social-api.md))
- **Business Entity:** `Comment` + read model `CommentView` ([backend/01-business-entities.md](../backend/01-business-entities.md#comment))
- **Database Entity:** `comments` table / `CommentRow` ([persistence/01-schema.md](../persistence/01-schema.md#comments))
- **Mappers:** `mapCreateCommentDtoToCommand`, `mapCommentViewToResponseDto`, `mapCommentRowToEntity`, `mapCommentEntityToRow`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`comments`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Identifier | `id: string` (`cmt_…`, res) | `id: CommentId` | `id uuid PK` | UUIDv7 |
| Post | `post_id: string` (`pst_…`, res; path param on create) | `postId: PostId` | `post_id uuid NOT NULL FK → posts(id) ON DELETE CASCADE` | Post must exist and not be deleted |
| Author | `author: UserSummaryDto` (res) | `authorId: UserId` | `author_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | From `AuthContext` |
| Text | `text: string` (req, res) | `text: CommentText` | `text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500)` | Trimmed; 1–500 chars |
| Created | `created_at: string` (res) | `createdAt: Date` | `created_at timestamptz NOT NULL DEFAULT now()` | Comments listed oldest → newest |
| Deletion | — | `deletedAt: Date \| null` | `deleted_at timestamptz NULL` | Soft delete by comment author or post author; decrements `posts.comment_count` |

## ENT-Like

- **Summary:** A user's like on a post (idempotent toggle).
- **API DTOs:** `LikeStateResponseDto` (no request body) ([04-social-api.md](../external-communication/04-social-api.md))
- **Business Entity:** `Like` ([backend/01-business-entities.md](../backend/01-business-entities.md#like))
- **Database Entity:** `post_likes` table / `PostLikeRow` ([persistence/01-schema.md](../persistence/01-schema.md#post_likes))
- **Mappers:** `mapLikeStateToResponseDto`, `mapPostLikeRowToEntity`, `mapLikeEntityToRow`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`post_likes`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Post | `post_id: string` (path param; res) | `postId: PostId` | `post_id uuid NOT NULL FK → posts(id) ON DELETE CASCADE` | Part of PK |
| User | — (from token) | `userId: UserId` | `user_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | Part of PK `(post_id, user_id)`; one like per user per post |
| Liked state | `liked: boolean` (res) | `LikeState.liked` | — (row exists) | `PUT` → true, `DELETE` → false; both idempotent |
| Like count | `like_count: number` (res) | `LikeState.likeCount` | `posts.like_count` | Read after mutation in the same tx |
| Created | — | `createdAt: Date` | `created_at timestamptz NOT NULL DEFAULT now()` | — |

## ENT-Follow

- **Summary:** A directed follow relationship between two users.
- **API DTOs:** `FollowStateResponseDto`, `UserSummaryPageResponseDto` (followers/following lists) ([04-social-api.md](../external-communication/04-social-api.md))
- **Business Entity:** `Follow` ([backend/01-business-entities.md](../backend/01-business-entities.md#follow))
- **Database Entity:** `follows` table / `FollowRow` ([persistence/01-schema.md](../persistence/01-schema.md#follows))
- **Mappers:** `mapFollowStateToResponseDto`, `mapFollowRowToEntity`, `mapFollowEntityToRow`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`follows`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Follower | — (from token) | `followerId: UserId` | `follower_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | Part of PK |
| Followee | `username` (path param); res `user_id: string` (`usr_…`) | `followeeId: UserId` | `followee_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | PK `(follower_id, followee_id)`; `CHECK (follower_id <> followee_id)` → `422 CANNOT_FOLLOW_SELF` |
| Following state | `following: boolean` (res) | `FollowState.following` | — (row exists) | `PUT` / `DELETE` idempotent |
| Followers count | `followers_count: number` (res) | `FollowState.followersCount` | `users.followers_count` of followee | Updated in same tx |
| Created | `followed_at: string \| null` (res, list items) | `createdAt: Date` | `created_at timestamptz NOT NULL DEFAULT now()` | Lists ordered newest first |

## ENT-Story

- **Summary:** A single photo/video story that is visible for 24 hours.
- **API DTOs:** `CreateStoryRequestDto`, `StoryResponseDto`, `StoryTrayResponseDto`, `UserStoriesResponseDto` ([05-stories-api.md](../external-communication/05-stories-api.md))
- **Business Entity:** `Story` + read models `StoryItemView` / `StoryTrayItem` ([backend/01-business-entities.md](../backend/01-business-entities.md#story))
- **Database Entity:** `stories` table / `StoryRow` ([persistence/01-schema.md](../persistence/01-schema.md#stories))
- **Mappers:** `mapCreateStoryDtoToCommand`, `mapStoryItemViewToResponseDto`, `mapStoryTrayItemToDto`, `mapStoryRowToEntity`, `mapStoryEntityToRow`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`stories`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Identifier | `id: string` (`sty_…`, res) | `id: StoryId` | `id uuid PK` | UUIDv7 |
| Author | `author: UserSummaryDto` (res) | `authorId: UserId` | `author_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | From `AuthContext` |
| Media | req `media_id: string` (`med_…`); res `media: MediaResponseDto` | `mediaId: MediaId` | `media_id uuid NOT NULL UNIQUE FK → media_assets(id) ON DELETE CASCADE` | Owned by author, purpose `story`, status `uploaded` |
| Created | `created_at: string` (res) | `createdAt: Date` | `created_at timestamptz NOT NULL DEFAULT now()` | — |
| Expiry | `expires_at: string` (res) | `expiresAt: Date` | `expires_at timestamptz NOT NULL`, `CHECK (expires_at > created_at)` | `createdAt + 24h`; expired stories invisible to every read; hard-deleted by `StoryCleanupJob` |
| Viewer seen | `viewer_has_seen: boolean` (res) | `StoryItemView.viewerHasSeen` | — (computed `EXISTS` on `story_views`) | — |
| View count | `view_count: number \| null` (res) | `StoryItemView.viewCount` | — (computed `count(*)` on `story_views`) | Only returned to the author; `null` for others |
| Deletion | — | — | — (hard delete) | Author may delete early (`DELETE /stories/{id}`) |

## ENT-StoryView

- **Summary:** Record that a user has seen a story (for "seen" rings and author viewer list).
- **API DTOs:** `MarkStorySeenRequest` (no body, `POST`), `StoryViewerResponseDto`, `StoryViewerPageResponseDto` ([05-stories-api.md](../external-communication/05-stories-api.md))
- **Business Entity:** `StorySeen` ([backend/01-business-entities.md](../backend/01-business-entities.md#storyseen))
- **Database Entity:** `story_views` table / `StoryViewRow` ([persistence/01-schema.md](../persistence/01-schema.md#story_views))
- **Mappers:** `mapStoryViewerToResponseDto`, `mapStoryViewRowToEntity`, `mapStorySeenEntityToRow`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`story_views`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Story | `story_id` (path param) | `storyId: StoryId` | `story_id uuid NOT NULL FK → stories(id) ON DELETE CASCADE` | Story must be unexpired |
| Viewer | res `user: UserSummaryDto` | `viewerId: UserId` | `viewer_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | PK `(story_id, viewer_id)`; author viewing own story is not recorded |
| Viewed at | `viewed_at: string` (res) | `viewedAt: Date` | `viewed_at timestamptz NOT NULL DEFAULT now()` | `INSERT … ON CONFLICT DO NOTHING` (first view wins) |

## ENT-Notification

- **Summary:** An in-app activity notification (like, comment, follow) delivered live over SSE and listed in the activity page.
- **API DTOs:** `NotificationResponseDto`, `NotificationPageResponseDto`, `MarkNotificationsReadRequestDto`, `UnreadCountResponseDto` ([06-feed-search-notifications-api.md](../external-communication/06-feed-search-notifications-api.md)); SSE `notification.created` event ([internal-communication/02-domain-events-and-sse.md](../internal-communication/02-domain-events-and-sse.md))
- **Business Entity:** `Notification` + read model `NotificationView` ([backend/01-business-entities.md](../backend/01-business-entities.md#notification))
- **Database Entity:** `notifications` table / `NotificationRow` ([persistence/01-schema.md](../persistence/01-schema.md#notifications))
- **Mappers:** `mapNotificationViewToResponseDto`, `mapMarkReadDtoToCommand`, `mapNotificationRowToEntity`, `mapNotificationEntityToRow`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`notifications`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Identifier | `id: string` (`ntf_…`, res) | `id: NotificationId` | `id uuid PK` | UUIDv7 |
| Recipient | — (from token) | `recipientId: UserId` | `recipient_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | Never equal to actor (self-actions do not notify) |
| Actor | `actor: UserSummaryDto` (res) | `actorId: UserId` | `actor_id uuid NOT NULL FK → users(id) ON DELETE CASCADE` | — |
| Type | `type: "like" \| "comment" \| "follow"` (res) | `type: NotificationType` | `type text NOT NULL CHECK (type IN ('like','comment','follow'))` | — |
| Post | `post_id: string \| null` (`pst_…`); `post_thumbnail_url: string \| null` (res) | `postId: PostId \| null` | `post_id uuid NULL FK → posts(id) ON DELETE CASCADE` | Required for `like`/`comment`; null for `follow` |
| Comment | `comment_id: string \| null`, `comment_text: string \| null` (res) | `commentId: CommentId \| null` | `comment_id uuid NULL FK → comments(id) ON DELETE CASCADE` | Required for `comment` only |
| Read state | `read_at: string \| null` (res); req `MarkNotificationsReadRequestDto.up_to_id` | `readAt: Date \| null` | `read_at timestamptz NULL` | Mark-read sets `read_at = now()` for all ids ≤ `up_to_id` |
| Created | `created_at: string` (res) | `createdAt: Date` | `created_at timestamptz NOT NULL DEFAULT now()` | Listed newest first |
| Dedupe | — | — | partial unique indexes `notifications_like_uq (recipient_id, actor_id, post_id) WHERE type = 'like'` and `notifications_follow_uq (recipient_id, actor_id) WHERE type = 'follow'` | Unlike/unfollow deletes the matching notification; re-like does not duplicate |
