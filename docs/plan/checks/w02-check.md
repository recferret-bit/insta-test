# Wave w02 — Posts, Likes & Comments: Owner Check Guide

Branch `wave/w02-posts-engagement` · compose project `yd-insta-w02` · slot 2 · web `http://localhost:21040` · api `http://localhost:21041`
(proxy URLs: `http://w02--insta.apps.localhost:9080`, `http://api--w02--insta.apps.localhost:9080`).

## Executive Summary

W02 adds the core content loop. Users publish posts with 1–10 photos or videos, in the order they picked them, plus a
caption whose `#hashtags` are extracted (lowercased and de-duplicated) and recomputed on edit. Authors can edit the
caption and soft-delete the post. Anyone can read a post and a user's post list. Likes are idempotent and come with a
likers list. Comments are flat, listed oldest first, and can be deleted by the comment author or the post author
(`INV-10`). Every counter (`like_count`, `comment_count`, `users.posts_count`) and every like/comment notification is
written in the same transaction as its source row. Events (`PostCreated`, `PostDeleted`, `PostLiked`, `CommentAdded`,
`NotificationCreated`, `PostCountersChanged`) are published only after commit. Deleted posts return `404` on every
read and on like/comment (`INV-07`). On the web, `/create` is the post composer (validated picker, drag/keyboard
reorder, caption counters, 3 parallel uploads with retry) and `/p/:postId` is the post detail page (carousel,
optimistic like with double-tap, infinite comments, author menu). `PostCard`/`PostGrid` are ready for the w05 feed and
profile.

W02-05 validation (2 iterations) results:

| Check | Result |
|---|---|
| Wave audit (`validate-wave.mjs`) | `ok`, no errors or warnings |
| Spec validator (`validate-specs.mjs`) | `valid: true` |
| `npm run typecheck` / `npm run lint` / `npm run format:check` | pass |
| Unit tests (`npm test`) | contracts 47, api 384, web 397, all pass |
| Integration tests (`npm run test:integration`, PostgreSQL 16) | 168 / 168 pass (1 added in W02-05) |
| E2E | none yet (Playwright scheduled for w07) |
| `vite build` (web) | pass |
| Live API smoke run on port 21041 | create 3-media post → like → comment → edit → delete, all as expected (QL-w02-06) |
| Compose preview slot 2 | rendered only; no Docker in the sandbox (QL-w02-06) |

Iteration 1 found no spec-parity, layering (`api → domain ← data`), row-leak, size-cap (largest wave file 388 lines) or
stray-file defects. It added the missing tests: `LikeService`/`CommentService` "a failure after events were collected
rolls back and publishes nothing", and the `INV-05` integration test that recomputes `like_count`/`comment_count` from
live rows after mixed like/unlike/comment/delete traffic. Iteration 2 recorded the ledger below and re-ran all gates.

## Delivered Features

- `F-BE-03` — `PostService` (createPost with media locked `FOR UPDATE`, editCaption, deletePost soft delete, getPost, listUserPosts)
- `F-BE-04` — `LikeService` (idempotent like/unlike, likers) and `CommentService` (add, delete with `INV-10`, list ascending)
- `F-ECOMM-05` — `POST /posts`, `GET|PATCH|DELETE /posts/{id}`, `GET /users/{username}/posts`
- `F-ECOMM-06` — `PUT|DELETE /posts/{id}/like`, `GET /posts/{id}/likes`, `GET|POST /posts/{id}/comments`, `DELETE /comments/{id}`
- `F-FE-04` — `/create` (`CreatePostPage`, `MediaPicker`, `state/posts-composer`), shared `PostCard`, `PostGrid`, `MediaCarousel`, `CaptionText`
- `F-FE-05` — `/p/:postId` (`PostPage`, `LikeButton`, `CommentList`, `CommentComposer`, `PostMenu`, `state/posts|likes|comments`)
- `F-CORE-03` — ENT-Post, ENT-Like, ENT-Comment entities with DTO ↔ Business ↔ Row mappers
- `F-DB-04` — integration tests against real PostgreSQL

## Step-by-Step Verification Guide

### Step 1 — Static gates and unit tests (`F-CORE-03`)

- **Where:** repository root on `wave/w02-posts-engagement`.
- **How:** `npm ci && npm run typecheck && npm run lint && npm run format:check && npm test && npm run build -w apps/web`
- **Expected:** every command exits 0; vitest reports contracts 47, api 384 and web 397 tests passed.

### Step 2 — Integration tests on PostgreSQL 16 (`F-DB-04`, `F-ECOMM-05`, `F-ECOMM-06`)

- **Where:** repository root, with a disposable PostgreSQL 16 database (it is wiped).
- **How:** `docker run -d --rm --name w02-pg -e POSTGRES_PASSWORD=pg -p 55432:5432 postgres:16-alpine` then
  `TEST_DATABASE_URL=postgres://postgres:pg@localhost:55432/postgres npm run test:integration`
- **Expected:** `Test Files 11 passed`, `Tests 168 passed`, including `posts.test.ts` (create/read/edit/delete/list, concurrent same-media create, concurrent delete) and `engagement.test.ts` (likes, comments, `INV-05` recompute, concurrent like and comment-delete).

### Step 3 — Wave audit and spec validation

- **Where:** repository root.
- **How:** `node .yardos/skills/wave-validate/scripts/validate-wave.mjs --root . --wave w02 --require-guide --json` and
  `node .agents/skills/spec-architect/scripts/validate-specs.mjs --root . --json`
- **Expected:** `"ok": true` with empty `errors`, and `gaps_file_path` is `docs/questions-and-limitations/w02-gaps.md`; the spec validator reports `"valid": true`.

### Step 4 — Render the slot-2 compose bundle (`F-INFRA-04`)

- **Where:** repository root.
- **How:** `node .yardos/skills/wave-compose-deploy/scripts/compose-wave.mjs --root . --project insta --wave w02 --slot-index 2 --render-only --json`
- **Expected:** `"compose_project": "yd-insta-w02"`, `"port_base": 21040`, web → `21040`, api → `21041`; `.yardos/waves/w02/compose.wave.yml` publishes no host port for `db`.

### Step 5 — Start the w02 stack

- **Where:** a Docker host, at the repository root.
- **How:** create `.yardos/waves/w02/compose.local.yml` with
  `services: { api: { environment: { PUBLIC_URL: "http://localhost:21040", PUBLIC_API_URL: "http://localhost:21041", CORS_ORIGIN: "http://localhost:21040" } }, web: { environment: { PUBLIC_URL: "http://localhost:21040", PUBLIC_API_URL: "http://localhost:21041" } } }`
  then run
  `export POSTGRES_PASSWORD=$(openssl rand -hex 16) && docker compose --project-directory . -p yd-insta-w02 -f .yardos/waves/w02/compose.base.yml -f .yardos/waves/w02/compose.wave.yml -f .yardos/waves/w02/compose.local.yml --env-file .yardos/waves/w02/.env.wave up -d --build --wait`
- **Expected:** exits 0 with `db`, `api`, `web` all `Healthy`; `curl http://localhost:21041/api/v1/health` → `200 {"status":"ok","db":"ok",…}`.

### Step 6 — Create a 3-media post (`F-ECOMM-05`, `F-BE-03`)

- **Where:** `POST http://localhost:21041/api/v1/media` then `POST http://localhost:21041/api/v1/posts`
- **How:** sign up `alice`, `bob`, `carol` (`POST /auth/signup`, keep each `access_token` as `$A`, `$B`, `$C`). As alice upload three images:
  `curl -s -X POST localhost:21041/api/v1/media -H "authorization: Bearer $A" -F purpose=post -F file=@1.jpg` (×3, note `med_…` ids M1–M3). Then
  `curl -s -X POST localhost:21041/api/v1/posts -H "authorization: Bearer $A" -H 'content-type: application/json' -d '{"caption":"Sunset #Beach #beach #golden_hour","media_ids":["M3","M1","M2"]}'`.
  Repeat the same body; then send 11 media ids; then a media id uploaded by bob; then a `purpose=story` upload.
- **Expected:** `201` `PostResponseDto` with `id: "pst_…"`, `media` in the order M3, M1, M2, `hashtags: ["beach","golden_hour"]`, `like_count: 0`, `comment_count: 0`. The three `media_assets` rows become `status = 'attached'` and `users.posts_count` for alice is `1`. The repeat → `422 MEDIA_INVALID` (already attached); 11 ids → `400 VALIDATION_FAILED`; bob's media and story media → `422 MEDIA_INVALID`, with no post row written. Without a token → `401`.

### Step 7 — Read a post and a user's posts (`F-ECOMM-05`)

- **Where:** `GET http://localhost:21041/api/v1/posts/{pst_id}` and `GET http://localhost:21041/api/v1/users/alice/posts?limit=1`
- **How:** call the post anonymously and with `$B`; create a second post and page alice's posts with `limit=1` then `cursor=<next_cursor>`; call `GET /posts/pst_zzz`.
- **Expected:** `200` both times; anonymous → `viewer_has_liked: false`, `author.is_following: null`. The user list returns newest first, one per page, then `next_cursor: null`. A malformed id or tampered cursor → `400 VALIDATION_FAILED`; an unknown user → `404`.

### Step 8 — Like, unlike and likers (`F-ECOMM-06`, `F-BE-04`, `INV-02`, `INV-08`)

- **Where:** `PUT|DELETE http://localhost:21041/api/v1/posts/{pst_id}/like`, `GET …/likes`
- **How:** `PUT` as bob twice; `PUT` as alice (self-like); `GET …/likes` with `$C`; `DELETE` as carol (never liked); `DELETE` as bob twice; then re-like as bob.
- **Expected:** bob's two `PUT`s both return `200 {"liked":true,"like_count":1}`, leaving one `post_likes` row and one `like` notification for alice. Alice's self-like returns `like_count: 2` and creates no notification. Likers come back newest first (`alice`, `bob`) with `followed_at` = the like time. Carol's `DELETE` → `200 {"liked":false,"like_count":2}`, nothing changes. Bob's first `DELETE` → `like_count: 1` and his like notification is deleted; the second is a no-op. Counters never go below 0.

### Step 9 — Comments (`F-ECOMM-06`, `F-BE-04`, `INV-10`)

- **Where:** `POST|GET http://localhost:21041/api/v1/posts/{pst_id}/comments`, `DELETE http://localhost:21041/api/v1/comments/{cmt_id}`
- **How:** as carol post `{"text":"  great shot  "}`; post `{"text":"   "}` and a 501-char text; as alice comment on her own post; list comments anonymously; `DELETE` carol's comment as bob, then as alice (post author), then again.
- **Expected:** `201` with `text: "great shot"` (trimmed), `comment_count +1` and one `comment` notification for alice (none for her own comment). Blank or 501 chars → `400 VALIDATION_FAILED`. The list is oldest first. Bob → `403 FORBIDDEN`; alice → `204`, `comment_count -1`, the comment disappears from the list, and its notification row stays (hidden by the w06 list). The second delete → `404`.

### Step 10 — Edit caption and delete the post (`F-ECOMM-05`, `F-BE-03`, `INV-07`)

- **Where:** `PATCH|DELETE http://localhost:21041/api/v1/posts/{pst_id}`
- **How:** `PATCH` `{"caption":"hack"}` as bob, then `{"caption":"Edited #Sea"}` as alice; `DELETE` as bob, then as alice; then `GET` the post, `PUT …/like` as carol, `POST …/comments` as carol, `GET /users/alice`.
- **Expected:** bob → `403 FORBIDDEN` both times. Alice's edit → `200` with `hashtags: ["sea"]`, a later `updated_at`, and the same media and counters. Delete → `204` with `deleted_at` set (soft delete) and alice's `posts_count` decremented once. After that, read, like and comment all → `404 NOT_FOUND`, and the post is gone from `/users/alice/posts`.

### Step 11 — Web composer `/create` (`F-FE-04`)

- **Where:** `http://localhost:21040/create` (logged in as alice).
- **How:** pick 3 images plus a `.txt` file and a video longer than 60 s; reorder by dragging and with the "Move earlier/later" buttons; type a caption with 31 hashtags, then a valid one; click Share.
- **Expected:** the text file and the long video are rejected with inline messages. Each image shows upload progress, and failed uploads offer Retry. The reorder buttons keep focus and announce the new position. The caption counters show `n/2200` and block more than 30 hashtags. Share stays disabled until every upload succeeds, then navigates to `/p/pst_…` with the media in the chosen order.

### Step 12 — Web post page `/p/:postId` (`F-FE-05`)

- **Where:** `http://localhost:21040/p/<pst_id>` as bob, then as alice.
- **How:** click the carousel arrows/dots and press `←`/`→`; double-tap the media twice; click the heart; scroll the comments; add a comment; stop the api (`docker compose -p yd-insta-w02 stop api`) and click the heart again; restart the api. As alice open the `…` menu and edit the caption, then delete with confirm.
- **Expected:** the carousel moves between the 3 media. Double-tap likes with a pop animation and never unlikes. The heart toggles instantly; with the api down it rolls back and shows an error. Comments load more as you scroll, and a new comment appears with the count updated. `#tags` in the caption are links. The author menu is shown only to alice; edit updates the caption in place, and delete (after the confirm) replaces the page with alice's profile path; reopening the post URL then shows the not-found state.

### Step 13 — Tear down

- **Where:** repository root.
- **How:** `docker compose -p yd-insta-w02 down -v` (or `compose-wave.mjs --root . --project insta --wave w02 --down --json`).
- **Expected:** containers, network and volumes of `yd-insta-w02` are removed; other wave stacks are untouched.

## Open Questions & Limitations

- [ ] **QL-w02-01** (`F-CORE-03`, `persistence`): W02-01 added two read-model row mappers that are not in the mapper tables of persistence/03-row-mappers.md or specs/03-domain-and-entity-map.md: `mapCommentViewRow` (comments ⋈ users → `CommentView`) and `mapPostLikerViewRow` (post_likes ⋈ users → `UserRelationView`).
- [ ] **QL-w02-02** (`F-BE-04`, `backend`): `post_likes` has no `id` column, so the likers keyset cursor `(liked_at, id)` uses the liker's `user_id` as the tie-break; backend/03 and external-communication/04 describe cursors only as `(created_at, id)`.
- [ ] **QL-w02-03** (`F-FE-05`, `frontend`): frontend/02 defines `CommentViewModel` without a `pending` flag, so an optimistically added comment cannot be shown as "sending" until the server returns it; W02-04 only patches the post's comment count optimistically.
- [ ] **QL-w02-04** (`F-ECOMM-06`, `external-communication`): The comment ports take no viewer, so `author.is_following` in `CommentResponseDto` is always `null`, even for signed-in viewers; external-communication/04 does not say whether comment authors carry the viewer's follow state.
- [ ] **QL-w02-05** (`F-CORE-01`, `specs`): Naming mismatch: docs/plan/waves/W02-posts-engagement.md calls W02-01 "contracts" while its work is post/like/comment domain entities and row mappers (the DTOs already existed); the W02-05 task spec_refs list 4 features while the wave plan covers and delivers 8 (`F-BE-03`, `F-BE-04`, `F-ECOMM-05`, `F-ECOMM-06`, `F-FE-04`, `F-FE-05`, `F-CORE-03`, `F-DB-04`).
- [ ] **QL-w02-06** (`F-INFRA-04`, `infra`): Docker is not available in the validation sandbox, so the slot-2 compose stack (`yd-insta-w02`, web 21040, api 21041) was only rendered, not started, and the browser flow (`/create` → `/p/:id`) was not clicked through. Substitute evidence: a live API smoke run on port 21041 against PostgreSQL 16 (3-media post, re-use 422, 11 media 400, like ×2 + self-like, likers, comment + blank 400, edit 403/200, comment delete 403/204, post delete 403/204, then 404 on read/like/comment, `posts_count` 1 → 0, 2 notifications in SQL).
- [ ] **QL-w02-07** (`F-INFRA-05`, `infra`): As in QL-w01-06, the rendered `.yardos/waves/w02/.env.wave` has no `POSTGRES_PASSWORD`, so `compose-wave.mjs --up` fails unless it is exported in the calling shell.
- [ ] **QL-w02-08** (`F-INFRA-04`, `infra`): `.yardos/` is gitignored, so `.yardos/waves/w02/review-packet.json` and the compose bundle exist only in the validator's working tree, not on the wave branch.
- [ ] **QL-w02-09** (`F-DB-04`, `persistence`): Keyset cursors encode `created_at` with millisecond precision (`Date.toISOString`), while the `posts`/`comments`/`post_likes` columns default to `now()` with microsecond precision. All API writes take `created_at` from the injected `Clock` (millisecond values), so API-created rows page correctly, but rows written with the SQL default (seed scripts, manual SQL) can be duplicated (comments, ascending) or skipped (posts/likers, descending) at a page boundary when they share a millisecond. The w03 follows list fixed the same issue with `date_trunc('milliseconds', created_at)`.
- [ ] **QL-w02-10** (`F-DB-04`, `infra`): The sandbox has no Docker or system Postgres; integration tests ran on a throwaway PostgreSQL 16 cluster (embedded-postgres binaries, `initdb -A trust`, port 55434). All 168 integration tests pass; CI on `postgres:16-alpine` stays authoritative.
- [ ] **QL-w02-11** (`F-FE-04`, `frontend`): There is no Playwright E2E suite yet (scheduled for w07), so the composer, post detail, like, comment and post-menu flows are covered only by component/hook tests with a mocked API.
- [ ] **QL-w02-12** (`F-BE-08`, `backend`): `GET /notifications` is not implemented yet (w06), so like/comment notifications written by w02 can only be checked in SQL during preview.
- [ ] **QL-w02-13** (`F-FE-04`, `frontend`): `PostGrid` and the `PostCard` feed mode (muted autoplay, "View all N comments") are built and unit-tested but not mounted on any page until the w05 profile/feed pages.
- [x] **QL-w02-14** (`F-BE-04`, `backend`): Acceptance criterion "events are published only after commit" had no LikeService/CommentService test for a failure after events were collected, and `INV-05` ("verified by an integration test that recomputes them") had no recompute test for `like_count`/`comment_count`; W02-05 added two unit tests and one integration test.
- [ ] **QL-w02-15** (`F-ECOMM-06`, `backend`): Should a comment notification be removed when its comment is soft-deleted? The current behaviour keeps the row and relies on the notification list hiding it (external-communication/04), while unliking deletes the like notification.
