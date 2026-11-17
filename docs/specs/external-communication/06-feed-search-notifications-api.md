# 06 — Feed, Explore, Search & Notifications API

Features: `F-ECOMM-09` (feed & explore), `F-ECOMM-10` (search), `F-ECOMM-11` (notifications). Entities: `ENT-Post`, `ENT-User`, `ENT-Notification`.

## Feed & Explore

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/v1/feed` | required | `?cursor&limit` | `200 PostPageResponseDto` | 400, 401 |
| `GET /api/v1/explore` | optional | `?cursor&limit` | `200 PostPageResponseDto` | 400 |

- Feed: non-deleted posts where `author_id` ∈ followees ∪ {viewer}, `ORDER BY created_at DESC, id DESC` (`DEC-09`).
- Explore: non-deleted posts by everyone except the viewer, same ordering.

## Search

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/v1/search/users` | optional | `?q=<1..50 chars>&limit=<1..30>` | `200 UserSearchResponseDto` | 400 |
| `GET /api/v1/search/hashtags` | none | `?q=<1..64 chars>&limit=<1..30>` | `200 HashtagSearchResponseDto` | 400 |
| `GET /api/v1/hashtags/{tag}/posts` | optional | `?cursor&limit` | `200 HashtagPostsResponseDto` | 400 |

```ts
type UserSearchResponseDto = { items: UserSummaryDto[] };

type HashtagResultDto = { tag: string; post_count: number };
type HashtagSearchResponseDto = { items: HashtagResultDto[] };

type HashtagPostsResponseDto = Page<PostResponseDto> & {
  tag: string;
  post_count: number;
};
```

- User search: `q` lowercased, leading `@` stripped; matches `username` prefix (rank 1), `full_name` ILIKE prefix of any word (rank 2), trigram similarity ≥ 0.3 (rank 3); ordered by rank, then `followers_count DESC`. No pagination (top `limit`).
- Hashtag search: `q` lowercased, leading `#` stripped; prefix match on `post_hashtags.tag` over non-deleted posts, ordered by `post_count DESC`.
- Unknown hashtag → `200` with empty `items` and `post_count: 0`.

## Notifications

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/v1/notifications` | required | `?cursor&limit` | `200 NotificationPageResponseDto` | 400, 401 |
| `GET /api/v1/notifications/unread-count` | required | — | `200 UnreadCountResponseDto` | 401 |
| `POST /api/v1/notifications/read` | required | `MarkNotificationsReadRequestDto` | `200 UnreadCountResponseDto` | 400, 401 |

```ts
type NotificationResponseDto = {
  id: string;                         // ntf_…
  type: "like" | "comment" | "follow";
  actor: UserSummaryDto;
  post_id: string | null;             // pst_…
  post_thumbnail_url: string | null;  // first media of the post (image url, or video url)
  comment_id: string | null;          // cmt_…
  comment_text: string | null;        // truncated to 100 chars
  read_at: string | null;
  created_at: string;
};

type NotificationPageResponseDto = Page<NotificationResponseDto>;   // created_at DESC

type MarkNotificationsReadRequestDto = {
  up_to_id: string;     // ntf_…; marks this and all older notifications read
};

type UnreadCountResponseDto = { unread_count: number };
```

- Notifications referencing soft-deleted posts/comments are excluded from lists and counts.
- Live delivery of new notifications: SSE `notification.created` (see [internal-communication/02-domain-events-and-sse.md](../internal-communication/02-domain-events-and-sse.md)).

## SSE Stream (public surface)

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/v1/events/stream?ticket=<ticket>` | ticket | — | `200 text/event-stream` | 401 `UNAUTHENTICATED` (invalid/used/expired ticket) |

Protocol and event payloads are specified in [internal-communication/02-domain-events-and-sse.md](../internal-communication/02-domain-events-and-sse.md).

## Mapping (DTO ↔ Business)

| DTO | Business | Mapper |
|---|---|---|
| `?cursor&limit` | `PageRequest { cursor: FeedCursor \| null, limit }` | `mapPageQueryToRequest` (decodes cursor) |
| `Page<PostView>` | `PostPageResponseDto` | `mapPostPageToResponseDto` |
| `UserSummaryView[]` | `UserSearchResponseDto` | `mapUserSummaryToDto` |
| `HashtagStat { tag, postCount }` | `HashtagResultDto` | `mapHashtagStatToDto` |
| `NotificationView` | `NotificationResponseDto` | `mapNotificationViewToResponseDto` |
| `MarkNotificationsReadRequestDto` | `MarkReadCommand { recipientId, upToId }` | `mapMarkReadDtoToCommand` |
