# 02 — Typed API Client, State, ViewModels & Mappers

Features: `F-FE-02`, `F-FE-10`, `F-FE-12`.

## Typed API Client (`apps/web/src/api/`)

```ts
// api/http.ts
class ApiError extends Error { constructor(readonly status: number, readonly body: ErrorResponseDto) }

async function request<T>(method: string, path: string, opts?: {
  body?: unknown; query?: Record<string, string | number | undefined>;
  schema?: z.ZodType<T>; signal?: AbortSignal;
}): Promise<T>;
```

- Base URL `config.apiUrl + "/api/v1"`; adds `Authorization: Bearer` from the session store; JSON in/out.
- Non-2xx → parse `ErrorResponseDto` → throw `ApiError`. In dev builds responses are validated with the contract schema (`schema.parse`); in prod they are cast.
- Per-module endpoint files mirror the API: `api/auth.ts`, `api/users.ts`, `api/media.ts` (XHR upload with progress), `api/posts.ts`, `api/comments.ts`, `api/stories.ts`, `api/search.ts`, `api/notifications.ts`, `api/events.ts` (ticket). All param/return types come from `@insta/contracts`.

## Session Store (`state/session.ts`)

- `{ token: string | null; expiresAt: string | null; me: MeViewModel | null }`, persisted in `localStorage` key `insta.session` (`DEC-08`).
- Implemented with `useSyncExternalStore`; `storage` event syncs logout across tabs.
- On boot with a token: `GET /me`; failure `401` → clear.

## Query Keys (TanStack Query)

| Key | Source | Stale time |
|---|---|---|
| `["me"]` | `GET /me` | 5 min |
| `["feed"]` (infinite) | `GET /feed` | 30 s |
| `["explore"]` (infinite) | `GET /explore` | 60 s |
| `["post", postId]` | `GET /posts/{id}` | 30 s |
| `["comments", postId]` (infinite) | `GET /posts/{id}/comments` | 30 s |
| `["profile", username]` | `GET /users/{username}` | 60 s |
| `["userPosts", username]` (infinite) | `GET /users/{username}/posts` | 60 s |
| `["followers" \| "following", username]` (infinite) | follow lists | 60 s |
| `["storyTray"]` | `GET /stories/tray` | 30 s |
| `["userStories", username]` | `GET /users/{username}/stories` | 30 s |
| `["search", "users" \| "hashtags", q]` | search | 60 s |
| `["hashtag", tag]` (infinite) | hashtag posts | 60 s |
| `["notifications"]` (infinite) | list | 0 (SSE-driven) |
| `["unreadCount"]` | count | ∞ (SSE-driven) |

Mutations (like, follow, comment) are optimistic: patch every cached `PostViewModel`/`ProfileViewModel` with matching id via a `patchPostInCaches(postId, fn)` helper, roll back on error, and reconcile with the server response.

## ViewModels & `DTO → ViewModel` Mappers (`state/mappers/*.ts`)

ViewModels are UI-ready, `camelCase`, with pre-computed display strings. Mappers are pure and unit-tested.

| ViewModel | From DTO | Mapper | Derived fields |
|---|---|---|---|
| `UserSummaryViewModel` | `UserSummaryDto` | `toUserSummaryVM` | `avatarUrl` falls back to generated initials avatar; `profilePath = /u/${username}` |
| `ProfileViewModel` | `UserProfileResponseDto` | `toProfileVM` | `isSelf`, `countsLabel` (`1.2K` compact format via `Intl.NumberFormat`), `hasActiveStory` |
| `MeViewModel` | `MeResponseDto` | `toMeVM` | — |
| `MediaViewModel` | `MediaResponseDto` | `toMediaVM` | `aspectRatio` (clamped 4:5 … 1.91:1), `isVideo` |
| `PostViewModel` | `PostResponseDto` | `toPostVM` | `createdAtRelative` ("3h"), `createdAtTitle` (full date), `captionTokens` (text / hashtag / mention segments), `likeCountLabel`, `isOwn` |
| `CommentViewModel` | `CommentResponseDto` | `toCommentVM` | `createdAtRelative`, `canDelete` (own comment or own post) |
| `StoryViewModel` | `StoryResponseDto` | `toStoryVM` | `durationMs` (image 5000, video `media.duration_ms`), `remainingLabel` |
| `StoryTrayItemViewModel` | `StoryTrayItemDto` | `toStoryTrayItemVM` | `ringState: "unseen" \| "seen"` |
| `NotificationViewModel` | `NotificationResponseDto` | `toNotificationVM` | `message` ("liked your post", "commented: …", "started following you"), `href`, `isUnread` |
| `SearchResultViewModel` | `UserSummaryDto` / `HashtagResultDto` | `toUserResultVM` / `toHashtagResultVM` | `kind`, `href`, `subtitle` ("1,234 posts") |

Reverse direction (form → Request DTO) uses form mappers: `toSignupDto(form)`, `toLoginDto(form)`, `toUpdateProfileDto(form, original)` (only changed fields), `toCreatePostDto(caption, uploadedMediaIds)`, `toCreateCommentDto(text)`, `toCreateStoryDto(mediaId)`.

Server validation errors (`details[].path`) are mapped onto form fields by `mapApiErrorToFormErrors(error, fieldMap)`.

## SSE Client (`state/live.ts`)

1. When authenticated: `POST /events/ticket` → open `EventSource`.
2. Parse each `MessageEvent.data` with `ServerEvent.safeParse`; drop invalid; dedupe by `lastEventId` (LRU 200).
3. Dispatch: `notification.created` → prepend to `["notifications"]` first page + toast; `notification.unread_count` → `setQueryData(["unreadCount"])`; `post.counters` → `patchPostInCaches`.
4. On error: close, exponential backoff (1 s → 30 s max, jitter), fetch new ticket, reopen; on successful reopen invalidate `["notifications"]`, `["unreadCount"]`.
5. On logout: close stream.
