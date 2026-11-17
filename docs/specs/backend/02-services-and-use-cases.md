# 02 — Services & Use Cases

Each service lives in `apps/api/src/domain/<module>/<module>.service.ts`, receives ports via constructor, and is the only place that opens transactions (`uow.run`). Events listed under **Emits** are collected in the transaction and published after commit (see [internal-communication/02-domain-events-and-sse.md](../internal-communication/02-domain-events-and-sse.md)).

## IdentityService

Feature `F-BE-01`. Ports: `UserRepository`, `SessionRepository`, `MediaRepository`, `PasswordHasher`, `TokenGenerator`, `UnitOfWork`, `Clock`, `IdGenerator`.

| Method | Behaviour | Errors |
|---|---|---|
| `register(cmd: RegisterUserCommand): Promise<{ user: User; issued: IssuedSession }>` | Parse username/email, hash password, insert user + session in one tx | `VALIDATION_FAILED`, `USERNAME_TAKEN`, `EMAIL_TAKEN` |
| `login(cmd: LoginCommand): Promise<{ user: User; issued: IssuedSession }>` | Find by username or email; verify argon2id (dummy verify when not found); create session | `INVALID_CREDENTIALS` |
| `logout(sessionId)` | Set `revoked_at = now` | — |
| `authenticate(rawToken): Promise<AuthContext \| null>` | sha256 → lookup active session; returns `{ userId, sessionId }` | — |
| `getMe(userId): Promise<UserProfileView>` | Own profile incl. email | `UNAUTHENTICATED` if user vanished |
| `updateProfile(cmd: UpdateProfileCommand): Promise<UserProfileView>` | Validates fields; if `avatarMediaId` set → `assertAttachable(purpose avatar, kind image)` + attach; one tx | `USERNAME_TAKEN`, `MEDIA_INVALID` |
| `getProfile(username, viewerId?): Promise<UserProfileView>` | Read model query | `NOT_FOUND` |

## MediaService

Feature `F-BE-02`. Ports: `MediaRepository`, `MediaStorage`, `MediaProbe`, `Clock`, `IdGenerator`.

| Method | Behaviour | Errors |
|---|---|---|
| `upload(cmd: UploadMediaCommand): Promise<MediaAsset>` | Sniff type from first 4100 bytes; enforce size limit while streaming (abort at limit); probe image dims; write file via `MediaStorage.put`; insert row; delete file if insert fails | `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `VALIDATION_FAILED` (video without `durationMs`, avatar video) |

## PostService

Feature `F-BE-03`. Ports: `PostRepository`, `MediaRepository`, `UserRepository`, `UnitOfWork`, `Clock`, `IdGenerator`.

| Method | Behaviour | Errors | Emits |
|---|---|---|---|
| `createPost(cmd)` | Load media `FOR UPDATE`; `assertAttachable` each (purpose post); `Post.create`; insert post rows; mark media attached; `users.posts_count += 1` | `MEDIA_INVALID`, `VALIDATION_FAILED` | `PostCreated` |
| `editCaption(cmd)` | Load post; `assertCanModify`; `Post.editCaption`; replace hashtags | `NOT_FOUND`, `FORBIDDEN` | — |
| `deletePost(postId, actorId)` | `assertCanModify`; set `deleted_at`; `posts_count -= 1` | `NOT_FOUND`, `FORBIDDEN` | `PostDeleted` |
| `getPost(postId, viewerId?)` | `PostView` | `NOT_FOUND` | — |
| `listUserPosts(username, viewerId?, page)` | Profile grid | `NOT_FOUND` | — |

## LikeService

Feature `F-BE-04`. Ports: `LikeRepository`, `PostRepository`, `NotificationRepository`, `UnitOfWork`, `Clock`, `IdGenerator`.

| Method | Behaviour | Emits |
|---|---|---|
| `like(postId, userId): Promise<LikeState>` | Ensure post live; `INSERT … ON CONFLICT DO NOTHING`; if inserted: `like_count += 1`, create notification (if not self) | `PostLiked`, `NotificationCreated` (if any), `PostCountersChanged` |
| `unlike(postId, userId): Promise<LikeState>` | `DELETE`; if deleted: `like_count -= 1`, delete like notification | `PostCountersChanged` |
| `listLikers(postId, viewerId?, page)` | `UserSummaryView` page | — |

## CommentService

Feature `F-BE-04`. Ports: `CommentRepository`, `PostRepository`, `NotificationRepository`, `UnitOfWork`, `Clock`, `IdGenerator`.

| Method | Behaviour | Emits |
|---|---|---|
| `addComment(cmd): Promise<CommentView>` | Ensure post live; insert; `comment_count += 1`; notification (if not self) | `CommentAdded`, `NotificationCreated`, `PostCountersChanged` |
| `deleteComment(commentId, actorId)` | `assertCanDelete`; soft delete; `comment_count -= 1` | `PostCountersChanged` |
| `listComments(postId, page)` | Ascending page | — |

## FollowService

Feature `F-BE-05`. Ports: `FollowRepository`, `UserRepository`, `NotificationRepository`, `UnitOfWork`, `Clock`, `IdGenerator`.

| Method | Behaviour | Emits |
|---|---|---|
| `follow(followerId, username): Promise<FollowState>` | Resolve followee; `Follow.create`; insert-if-absent; if inserted update both counters + notification | `UserFollowed`, `NotificationCreated` |
| `unfollow(followerId, username): Promise<FollowState>` | Delete-if-present; if deleted update counters + delete follow notification | — |
| `listFollowers / listFollowing(username, viewerId?, page)` | `UserSummaryView` page with relation time | — |

Counter updates lock rows in a deterministic order (`ORDER BY id`) to avoid deadlocks on mutual follows.

## StoryService

Feature `F-BE-06`. Ports: `StoryRepository`, `MediaRepository`, `UnitOfWork`, `Clock`, `IdGenerator`.

| Method | Behaviour | Errors |
|---|---|---|
| `createStory(cmd): Promise<StoryItemView>` | `assertAttachable(purpose story)`; `Story.create`; attach media | `MEDIA_INVALID` |
| `deleteStory(storyId, actorId)` | Author only; in one tx delete the `stories` row and its `media_assets` row; after commit remove the file via `MediaStorage.remove` (failure logged, not surfaced) | `NOT_FOUND`, `FORBIDDEN` |
| `getTray(viewerId): Promise<StoryTrayItem[]>` | Active stories of followees ∪ self | — |
| `getUserStories(username, viewerId?)` | Active stories ascending | `NOT_FOUND` |
| `markSeen(storyId, viewerId)` | Active check; skip if author; insert-if-absent | `NOT_FOUND` |
| `listViewers(storyId, actorId, page)` | Author only | `FORBIDDEN`, `NOT_FOUND` |

## FeedService & SearchService

Feature `F-BE-07`. Ports: `FeedQueries`, `SearchQueries` (read-only query ports implemented in `data/`).

| Method | Behaviour |
|---|---|
| `FeedService.homeFeed(viewerId, page)` | Followees ∪ self, keyset on `(created_at, id)` |
| `FeedService.explore(viewerId?, page)` | Everyone except viewer |
| `SearchService.searchUsers(q, viewerId?, limit)` | Ranked per external spec |
| `SearchService.searchHashtags(q, limit)` | Prefix + counts |
| `SearchService.hashtagPosts(tag, viewerId?, page)` | Posts with tag |

## NotificationService

Feature `F-BE-08`. Ports: `NotificationRepository`, `UnitOfWork`, `Clock`.

| Method | Behaviour |
|---|---|
| `list(recipientId, page)` | `NotificationView` page, excluding soft-deleted targets |
| `unreadCount(recipientId)` | Count where `read_at IS NULL` |
| `markRead(cmd: MarkReadCommand)` | Set `read_at` for ids ≤ `upToId` (UUIDv7 ordering) of that recipient; returns new unread count; emits `NotificationsRead` |

Notification **creation** is done by `LikeService`/`CommentService`/`FollowService` via `NotificationRepository` inside their transactions (no cross-service calls inside a tx).
