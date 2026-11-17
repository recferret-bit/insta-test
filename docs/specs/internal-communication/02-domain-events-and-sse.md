# 02 — Domain Events & SSE Live Updates

Features: `F-ICOMM-02` … `F-ICOMM-05`. Entity: `ENT-Notification`.

## Domain Events (in-process)

Defined in `apps/api/src/domain/shared/events.ts` as a discriminated union. Business IDs (UUID), `Date` values.

| Event | Payload | Emitted by | Subscribers |
|---|---|---|---|
| `PostCreated` | `{ postId, authorId, at }` | `PostService.createPost` | (logging only in v1) |
| `PostDeleted` | `{ postId, authorId, at }` | `PostService.deletePost` | (logging only) |
| `PostLiked` | `{ postId, userId, at }` | `LikeService.like` | (logging only) |
| `CommentAdded` | `{ commentId, postId, authorId, at }` | `CommentService.addComment` | (logging only) |
| `UserFollowed` | `{ followerId, followeeId, at }` | `FollowService.follow` | (logging only) |
| `NotificationCreated` | `{ notificationId, recipientId }` | Like/Comment/Follow services | `SseHub` → loads `NotificationView`, pushes `notification.created` + `notification.unread_count` |
| `NotificationsRead` | `{ recipientId, unreadCount }` | `NotificationService.markRead` | `SseHub` → pushes `notification.unread_count` (sync other tabs) |
| `PostCountersChanged` | `{ postId, authorId, likeCount, commentCount }` | Like/Comment services | `SseHub` → pushes `post.counters` to the post author |

### Bus Semantics

- `InProcessEventBus implements DomainEventPublisher` — synchronous fan-out to registered handlers wrapped in `queueMicrotask`; a throwing handler is logged and does not affect others or the HTTP response.
- `UnitOfWork.run` gives services an `EventCollector`; events are published **only after `COMMIT` succeeds** (`F-ICOMM-02`). On rollback the collector is discarded.
- Delivery is at-most-once, best-effort (no persistence of events). Durable state is the DB; clients reconcile on reconnect (`F-ICOMM-05`).

## SSE Protocol

### Ticket Exchange (`DEC-08`)

1. Client: `POST /api/v1/events/ticket` with bearer token → `{ ticket, expires_at }`.
2. Server stores `ticket → { userId, sessionId, expiresAt }` in an in-memory map (`SseTicketStore`), 32 random bytes base64url, TTL 60 s, single use.
3. Client: `new EventSource(`${apiUrl}/api/v1/events/stream?ticket=${ticket}`)`.
4. Server consumes the ticket (delete on read). Invalid/expired/used → `401` JSON error (EventSource then errors; client requests a new ticket with backoff).
5. Query string containing the ticket is redacted in logs.

### Stream

- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
- On open the server sends `retry: 5000` and an initial `notification.unread_count` event.
- Heartbeat: comment line `: ping` every 25 s.
- `SseHub` keeps `Map<UserId, Set<Connection>>`; max 5 connections per user (oldest closed when exceeded); connection removed on `close`.
- Session revocation (logout) closes that session's streams.

### Wire Format

```text
id: <uuidv7 event id>
event: notification.created
data: {"type":"notification.created","data":{...NotificationResponseDto...}}

```

### Server Events (`packages/contracts/src/events.ts`)

```ts
type ServerEvent =
  | { type: "notification.created"; data: NotificationResponseDto }
  | { type: "notification.unread_count"; data: { unread_count: number } }
  | { type: "post.counters"; data: { post_id: string; like_count: number; comment_count: number } };
```

| Event | Recipient | Client reaction |
|---|---|---|
| `notification.created` | Notification recipient | Prepend to notifications query cache, show toast, bump badge |
| `notification.unread_count` | The user (all tabs) | Set badge count |
| `post.counters` | Post author | Patch `like_count`/`comment_count` in any cached `PostViewModel` with that id |

### Idempotency & Ordering

- Each event carries a unique `id`; the client keeps an LRU set of the last 200 ids and ignores duplicates.
- Ordering is per-connection FIFO; no cross-connection ordering guarantee.
- `Last-Event-ID` is ignored (no replay); on `open` after a reconnect, the client invalidates `notifications` and `unread-count` queries.

## Scaling Limitation

The hub and ticket store are in-memory → correct only for a single API replica (`DEC-15`, `Q-04`). A future multi-replica setup would use Postgres `LISTEN/NOTIFY` as the fan-out channel without changing the wire protocol.
