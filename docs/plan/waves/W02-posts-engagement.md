# W02 — Posts, Likes & Comments

| Field | Value |
|---|---|
| Wave | `w02` (`posts-engagement`) |
| Depends on | `w01` |
| Runs concurrently with | `w03`, `w04` (disjoint `owned_paths`) |
| Branch | `wave/w02-posts-engagement` from `main` (after w01 lands) |
| Compose | `yd-insta-w02`, slot 2, ports 21040–21059 (web 21040, api 21041) |
| Migrations | none |
| Spec refs | `F-BE-03`, `F-BE-04`, `F-ECOMM-05`, `F-ECOMM-06`, `F-FE-04`, `F-FE-05`, `F-CORE-03`, `F-DB-04` |

## Goal

Publish posts with 1–10 photos/videos and a caption with `#hashtags`; view, edit caption and delete posts; list a user's
posts; like/unlike idempotently with a likers list; add, list and delete flat comments. Counters and notifications change
in the same transaction as the source row. Web: post composer, post detail page, and the reusable `PostCard` / `PostGrid`.

## Specs to Read First

ENT-Post, ENT-Comment, ENT-Like in `specs/03`; `INV-02`, `INV-03`, `INV-05`, `INV-07`, `INV-08`, `INV-10`; `backend/01`,
`backend/02` (PostService, LikeService, CommentService), `backend/03`; `external-communication/03` and `04` (likes,
comments); `internal-communication/02` (events emitted); `persistence/02` (feed / post view queries);
`frontend/01` (`/create`, `/p/:postId`, PostCard), `frontend/02`, `frontend/03`.

## Endpoints in Scope

| Endpoint | Route file | Task |
|---|---|---|
| `POST /posts`, `GET /posts/{id}`, `PATCH /posts/{id}`, `DELETE /posts/{id}`, `GET /users/{username}/posts` | `posts.routes.ts` | W02-02 |
| `PUT /posts/{id}/like`, `DELETE /posts/{id}/like`, `GET /posts/{id}/likes` | `likes.routes.ts` | W02-03 |
| `GET /posts/{id}/comments`, `POST /posts/{id}/comments`, `DELETE /comments/{id}` | `comments.routes.ts` | W02-03 |

## Task DAG

```text
W02-01 (contracts) ──┬── W02-02 Posts API
                     ├── W02-03 Likes & comments API
                     └── W02-04 Web composer, post detail & post components
                                └──► W02-05 validate
```

### W02-01 — Freeze post/like/comment entities & mappers (`contracts`)

- Confirm `dto/posts.ts`, `dto/comments.ts`.
- `Post.create` (1–10 media, positions `0..n-1`, caption ≤ 2200, ≤ 30 hashtags), `Post.editCaption` (recompute hashtags with
  `#([\p{L}\p{N}_]{1,64})`, lowercase, dedupe), `assertCanModify`; `Like`; `Comment` (1–500 trimmed, `assertCanDelete`
  for comment author or post author). `PostView`, `CommentView` in `posts/views.ts`.
- Row mappers + round-trip tests for `posts` + `post_media` + `post_hashtags`, `post_likes`, `comments`.
- Web `toPostVM` (`captionTokens`, `createdAtRelative`, `likeCountLabel`, `isOwn`) and `toCommentVM` (`canDelete`) tests.

### W02-02 — Posts API (`worker`)

- `PostService.createPost`: lock media `FOR UPDATE`, `assertAttachable(post)`, insert post rows, mark media attached,
  `posts_count += 1`, emit `PostCreated`. `editCaption`, `deletePost` (soft delete, `posts_count -= 1`, `PostDeleted`),
  `getPost`, `listUserPosts`.
- `posts.pg-repository.ts`: post page query + one batched hydration query for media, hashtags, authors and
  `viewer_has_liked` (`= ANY($ids)`, no N+1); keyset cursor `(created_at, id)`. Export the hydration step as a named
  function (`hydratePostViews(db, postRows, viewerId)`) so the w05 feed adapter can reuse it without editing this file.

### W02-03 — Likes & comments API (`worker`)

- `LikeService.like/unlike` (insert-if-absent / delete-if-present; counters via `adjustCounters`; notification
  `insertIfAbsent` unless self; `deleteFor` on unlike; events `PostLiked`, `NotificationCreated`, `PostCountersChanged`).
- `CommentService.addComment/deleteComment/listComments` (ascending; `comment_count` ±1; comment notification unless
  self; `CommentAdded`, `NotificationCreated`, `PostCountersChanged`).
- Deleted posts → `404` for like/comment (`INV-07`). Tests insert posts with the w00 SQL factories, not via `POST /posts`.

### W02-04 — Web composer, post detail & post components (`worker`)

- `CreatePostPage`: pick files (allowed MIME list), client checks (size, ≤ 10, video ≤ 60 s via `<video>` metadata),
  reorder (drag + keyboard buttons), caption with live 2200 counter, parallel uploads (max 3) with progress via the
  w01 upload hook, publish disabled until all uploads succeed, then navigate to `/p/:id`.
- `PostPage`: `MediaCarousel` (dots, arrows, swipe, `←/→`), optimistic `LikeButton` (pop animation), double-tap like
  (never unlike), comments infinite list + `CommentComposer`, author `PostMenu` (edit caption, delete with confirm).
- Shared components for later waves: `PostCard` (header, carousel, actions, caption with linkified `#tags`/`@mentions`,
  "View all N comments", muted autoplay when ≥ 60 % visible), `PostGrid` (tiles with video / multi-media icons, hover counts).
- Hooks `state/posts*`, `state/likes*`, `state/comments*` with optimistic `patchPostInCaches` + rollback.

### W02-05 — Validate (`validate`)

2-iteration `wave-validate`; compose preview on slot 2 (create a 3-media post, like, comment, edit, delete).

## Acceptance Criteria

- Each endpoint: happy path, `401`, `400` integration tests with contract-parsed responses.
- Create with 11 media → `400`; with someone else's / already attached / story-purpose media → `422 MEDIA_INVALID`.
- Media order in the response equals `media_ids` order; hashtags extracted and recomputed on edit.
- Edit/delete by non-author → `403`; deleted post → `404` on every read and on like/comment.
- `PUT like` twice → one row, `like_count = 1`, one notification; self-like → no notification (`INV-08`); `DELETE like`
  when not liked → `200 {liked:false}`.
- Comment deletion allowed for comment author and post author only (`INV-10`); counters never negative.
- Events are published only after commit (unit test with fake publisher).
- Web: composer validation, reorder, optimistic like rollback on error covered by tests.

## Out of Scope

Feed/explore/hashtag pages (w05), live counter push (w06), profile page (w05).
