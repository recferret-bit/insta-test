# External Communication Specifications

- **Status:** Active

The public contract of the system is the REST JSON API under `/api/v1/*` consumed by the web SPA
(and any future client), plus static media files under `/media/*`.
Third-party integrations: none (see [07-third-party-integrations.md](./07-third-party-integrations.md)).

| File | Content |
|---|---|
| [01-api-conventions.md](./01-api-conventions.md) | Base URL, auth header, error envelope & code catalog, pagination, CORS, rate limits |
| [02-auth-and-users-api.md](./02-auth-and-users-api.md) | Signup, login, logout, `/me`, profiles, SSE ticket |
| [03-media-and-posts-api.md](./03-media-and-posts-api.md) | Media upload & serving, posts CRUD, user post grid |
| [04-social-api.md](./04-social-api.md) | Likes, comments, follows, followers/following lists |
| [05-stories-api.md](./05-stories-api.md) | Story create/delete, tray, per-user stories, seen marks, viewers |
| [06-feed-search-notifications-api.md](./06-feed-search-notifications-api.md) | Home feed, explore, search, hashtags, notifications |
| [07-third-party-integrations.md](./07-third-party-integrations.md) | Third-party integrations — not applicable, with rationale |

## Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| `F-ECOMM-01` | API conventions | Every endpoint lives under `/api/v1`, accepts/returns `application/json` (except media upload/serving), uses `snake_case` fields and the error envelope. |
| `F-ECOMM-02` | Auth API | Signup/login return `AuthTokenResponseDto`; logout revokes the session; protected endpoints return `401 UNAUTHENTICATED` without a valid token. |
| `F-ECOMM-03` | Profiles API | `GET /users/{username}` returns `UserProfileResponseDto` with counters and `is_following`; `PATCH /me` updates profile fields. |
| `F-ECOMM-04` | Media API | Multipart upload validates type by magic bytes and size limits; files served with correct `Content-Type` and immutable cache headers. |
| `F-ECOMM-05` | Posts API | Create (1–10 media), get, edit caption, delete, list by user; responses include author summary, ordered media, hashtags, counters, `viewer_has_liked`. |
| `F-ECOMM-06` | Likes & comments API | Idempotent `PUT`/`DELETE` like; create/list/delete comments with cursor pagination. |
| `F-ECOMM-07` | Follows API | Idempotent follow/unfollow by username; followers/following cursor lists. |
| `F-ECOMM-08` | Stories API | Create/delete story, tray, per-user active stories, mark seen, author-only viewer list. |
| `F-ECOMM-09` | Feed & explore API | Cursor-paginated home feed and explore. |
| `F-ECOMM-10` | Search API | User search (username/full name prefix + trigram) and hashtag search; hashtag post list. |
| `F-ECOMM-11` | Notifications API | List, unread count, mark read. |
| `F-ECOMM-12` | No third-party integrations | No outbound HTTP calls exist in the codebase; CI greps for `fetch(`/`http.request` in `apps/api/src` outside tests and fails on matches. |
