# W03 — Likes, comments, follows, notifications & live SSE delivery

- **Wave:** `w03` · branch `wave/w03-social-notifications` from `main` after `w02` lands · depends on: `w02` · runs concurrently with `w04`, `w05`
- **Preview:** slot 3 → web `21060`, api `21061` (`yd-insta-w03`)
- **Exact `owned_paths`:** see `w03` in [WAVE_MANIFEST.json](../WAVE_MANIFEST.json)
- **Specs:** `ENT-Like`, `ENT-Comment`, `ENT-Follow`, `ENT-Notification`; [external-communication/04](../../specs/external-communication/04-social-api.md), [06 (notifications)](../../specs/external-communication/06-feed-search-notifications-api.md); [internal-communication/02](../../specs/internal-communication/02-domain-events-and-sse.md); `INV-01`, `INV-02`, `INV-05`, `INV-07`, `INV-08`, `INV-10`

## Goal

Add social interactions and live activity: idempotent like/unlike and follow/unfollow, flat comments, notifications that are created, deduplicated and removed inside the triggering transaction, a notification list/unread/mark-read API, SSE push of `notification.created`, `notification.unread_count` and `post.counters`, and the matching web UI (like, comments, follow, follow lists, activity page, live client).

## Tasks

| Task | Kind | Scope | Spec refs |
|---|---|---|---|
| W03-01 | contracts | Re-check comments/notifications/follow DTOs, `events.ts`, and the Like/Comment/Follow/Notification ports and rows. Implement `Notification` entity + `notification.row-mapper.ts` + `notification.pg-repository.ts` (all three backend workers call it inside their tx). Raw-SQL `social-fixtures.ts`. | F-BE-08, F-ICOMM-04, F-DB-04 |
| W03-02 | worker | `Like`/`Comment` entities, `LikeService`, `CommentService`, like/comment row mappers + repositories, `likes.routes.ts`, `comments.routes.ts`, DTO mappers. | F-BE-04, F-ECOMM-06 |
| W03-03 | worker | `Follow` entity, `FollowService` (counter rows locked `ORDER BY id`), follow row mapper + repository, `follows.routes.ts`, DTO mapper. | F-BE-05, F-ECOMM-07 |
| W03-04 | worker | `NotificationService`, `notifications.routes.ts`, `notification.dto-mapper.ts`, `api/sse/subscriptions.ts` (domain event → server event), initial unread-count provider. | F-BE-08, F-ECOMM-11, F-ICOMM-04 |
| W03-05 | worker | `components/social` (LikeButton, CommentSection, FollowButton, FollowListModal), `components/notifications`, `NotificationsPage`, `state/{social,comments,notifications,live}.ts`, `state/mappers/{social,notifications}.ts`. | F-FE-05, F-FE-06, F-FE-10, F-ICOMM-05 |
| W03-06 | validate | wave-validate ×2, including the like/comment/follow → stream test across siblings; `w03-check.md`, `w03-gaps.md`, review packet. | — |

## Acceptance criteria

- `PUT`/`DELETE` like and follow are idempotent. Counters change only when a row was actually inserted or deleted, in the same tx. Self-follow → `422 CANNOT_FOLLOW_SELF`.
- Comments are 1–500 chars and listed oldest first. They can be deleted by the comment author or the post author (`INV-10`). Deleted or soft-deleted posts cannot be liked or commented on (`404`).
- Self-actions create no notification (`INV-08`). Re-liking does not duplicate. Unlike/unfollow removes the matching notification. Mark-read sets `read_at` for ids ≤ `up_to_id`.
- Events are published only after commit. B's open stream receives `notification.created` for A's like/comment/follow within 1 s. The post author receives `post.counters`.
- Web: optimistic like/follow with rollback. Live client: safeParse, LRU-200 dedupe, backoff 1 s→30 s with jitter, invalidate notifications + unread count on reconnect, close on logout. Toast and badge update live.

## Tests required

Unit: entities, services with fakes (incl. rollback publishes nothing), mapper round-trips, `toNotificationVM` messages, live-client dedupe/backoff. Integration: every endpoint (happy, `401`, `400`), dedupe indexes, concurrent mutual follow without deadlock, SSE delivery.

## Cross-wave notes

- `domain/posts/ports.ts` and `dto/users.ts` were last edited by earlier waves. Allowed because w03 runs after them, and no concurrent wave (w04, w05) owns them.
- Do not edit `PostCard`/`PostPage` (w02) or `ProfilePage` (w01). Fill in the stub components they already render.
