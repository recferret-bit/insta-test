# W06 — Notifications & SSE Live Updates

| Field | Value |
|---|---|
| Wave | `w06` (`notifications-live`) |
| Depends on | `w02`, `w03` |
| Runs concurrently with | `w05`, and `w04` if it is still running (disjoint `owned_paths`) |
| Branch | `wave/w06-notifications-live` from `main` (after w02 and w03 land) |
| Compose | `yd-insta-w06`, slot 6, ports 21120–21139 (web 21120, api 21121) |
| Migrations | none |
| Spec refs | `F-BE-08`, `F-ECOMM-11`, `F-ICOMM-03`, `F-ICOMM-04`, `F-ICOMM-05`, `F-FE-10`, `F-ICOMM-01`, `F-CORE-03` |

## Goal

The activity feature: list notifications, unread count, mark read; a server → browser SSE stream with one-time tickets
that pushes `notification.created`, `notification.unread_count` and `post.counters`. Web: `NotificationsPage`, live
badge in the shell, toast on new notification, reconnect reconciliation.

## Specs to Read First

ENT-Notification in `specs/03`; `DEC-05`, `DEC-08`, `DEC-15`; `backend/02` (NotificationService), `backend/03`
(NotificationRepository); `external-communication/02` (`POST /events/ticket`), `06` (notifications);
`internal-communication/02` (complete); `frontend/01` (`/notifications`), `frontend/02` (SSE client).

## Endpoints in Scope

| Endpoint | Route file | Task |
|---|---|---|
| `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read` | `notifications.routes.ts` | W06-02 |
| `POST /events/ticket`, `GET /events/stream?ticket=` | `events.routes.ts` + `api/sse/` | W06-03 |

## Task DAG

```text
W06-01 (contracts) ──┬── W06-02 Notifications API
                     ├── W06-03 SSE ticket, stream & hub
                     └── W06-04 Web notifications page, badge & SSE client
                                └──► W06-05 validate
```

### W06-01 — Freeze notification DTOs, event schemas & read model (`contracts`)

Confirm `dto/notifications.ts` and the `ServerEvent` union in `events.ts`; `NotificationView` in `notifications/views.ts`;
web `toNotificationVM` and a `parseServerEvent` (`safeParse`) helper with tests.

### W06-02 — Notifications API (`worker`)

- `NotificationService.list` (newest first, hides items whose post/comment is soft-deleted), `unreadCount`,
  `markRead(upToId)` for ids ≤ `up_to_id` of that recipient (UUIDv7 order) → returns new count, emits `NotificationsRead`.
- Read side of `notifications.pg-repository.ts` (keep w01's write methods): actor summary, `post_thumbnail_url` (first media),
  `comment_text` truncated to 100 chars; uses `notifications_recipient_idx` / `notifications_unread_idx`.

### W06-03 — SSE ticket, stream & hub (`worker`)

- `SseTicketStore` (32 random bytes base64url, TTL 60 s, delete on read). `SseHub`: `Map<UserId, Set<Connection>>`, max 5
  per user (oldest closed), `retry: 5000` + initial `notification.unread_count` on open, `: ping` every 25 s, wire format
  `id/event/data` per spec, close all on shutdown.
- Bus subscriptions: `NotificationCreated` → load `NotificationView` → `notification.created` + `notification.unread_count`;
  `NotificationsRead` → `notification.unread_count`; `PostCountersChanged` → `post.counters` to the post author.
- Logout closes the session's streams: the hub re-checks the session at each heartbeat (planning note P-3; record in `w06-gaps.md`).
- Ticket query string redacted in logs; headers `text/event-stream`, `no-cache`, `X-Accel-Buffering: no`.

### W06-04 — Web notifications page, badge & SSE client (`worker`)

- Replace w00 stubs `state/sse*` and `state/notifications*`: fetch ticket (exponential backoff on failure), `EventSource`,
  drop invalid events, ignore duplicate ids, on (re)connect refetch unread count and invalidate `["notifications"]`,
  apply `post.counters` with `patchPostInCaches`, `401` on ticket → logout.
- `NotificationToast` on `notification.created`; badge count from `["unreadCount"]`.
- `NotificationsPage`: "New" (unread) vs "Earlier", `NotificationItem` (actor, verb, thumbnail, relative time, links),
  `POST /notifications/read` with newest id on open.

### W06-05 — Validate (`validate`)

2-iteration `wave-validate` incl. SSE integration tests; compose preview on slot 6 with two browsers (A likes B's post →
B sees toast + badge within 1 s; verify no buffering in the compose network path).

## Acceptance Criteria

- Each REST endpoint: happy path, `401`, `400` integration tests with contract-parsed responses.
- Ticket works once; reused or expired (fake clock) ticket → `401` (`F-ICOMM-03`).
- Like / comment / follow by A arrives on B's open stream as `notification.created` within 1 s (`F-ICOMM-04`).
- Rolled-back transaction publishes nothing to the stream; mark-read in one tab updates the count in another.
- Sixth connection for one user closes the oldest; logout closes that session's stream at the next heartbeat.
- Web: dedupe by event id, reconnect reconciliation, mark-read on open covered by tests (`F-ICOMM-05`).

## Out of Scope

Multi-replica fan-out (`Q-04`), push/email notifications (`DEC-06`).
