# Wave w02 — Gaps, Issues & Open Questions

> Automatically saved during wave validation (`wave-validate`) and compiled into `docs/questions-and-limitations/GAPS_AND_QUESTIONS.md` when the wave lands on `main`.

## Gaps
- [ ] **QL-w02-01** (`F-CORE-03`, `persistence`): W02-01 added two read-model row mappers that are not in the mapper tables of persistence/03-row-mappers.md or specs/03-domain-and-entity-map.md: `mapCommentViewRow` (comments ⋈ users → `CommentView`) and `mapPostLikerViewRow` (post_likes ⋈ users → `UserRelationView`).
  - Suggested fix: Add both mappers to the persistence/03 mapper table and the ENT-Comment / ENT-Like rows of specs/03.
- [ ] **QL-w02-02** (`F-BE-04`, `backend`): `post_likes` has no `id` column, so the likers keyset cursor `(liked_at, id)` uses the liker's `user_id` as the tie-break; backend/03 and external-communication/04 describe cursors only as `(created_at, id)`.
  - Suggested fix: State in backend/03 (pagination) that the likers cursor id is the liker's user id.
- [ ] **QL-w02-03** (`F-FE-05`, `frontend`): frontend/02 defines `CommentViewModel` without a `pending` flag, so an optimistically added comment cannot be shown as "sending" until the server returns it; W02-04 only patches the post's comment count optimistically.
  - Suggested fix: Add `pending?: boolean` to `CommentViewModel` in frontend/02 if an optimistic comment row is wanted.
- [ ] **QL-w02-04** (`F-ECOMM-06`, `external-communication`): The comment ports take no viewer, so `author.is_following` in `CommentResponseDto` is always `null`, even for signed-in viewers; external-communication/04 does not say whether comment authors carry the viewer's follow state.
  - Suggested fix: Document `author.is_following = null` for comments in external-communication/04, or add a viewer parameter to `CommentRepository.listByPost` in a later wave.
- [ ] **QL-w02-05** (`F-CORE-01`, `specs`): Naming mismatch: docs/plan/waves/W02-posts-engagement.md calls W02-01 "contracts" while its work is post/like/comment domain entities and row mappers (the DTOs already existed); the W02-05 task spec_refs list 4 features while the wave plan covers and delivers 8 (`F-BE-03`, `F-BE-04`, `F-ECOMM-05`, `F-ECOMM-06`, `F-FE-04`, `F-FE-05`, `F-CORE-03`, `F-DB-04`).
  - Suggested fix: Align task names and `spec_refs` in WAVE_MANIFEST.json with the wave plan.
- [ ] **QL-w02-16**: mapCommentViewRow and mapPostLikerViewRow read-model mappers are missing from the persistence/03 and specs/03 mapper tables.
- [ ] **QL-w02-17**: post_likes has no id column; the likers cursor tie-break uses the liker's user_id, which backend/03 and external-communication/04 do not state.
- [ ] **QL-w02-18**: CommentViewModel in frontend/02 has no pending flag, so an optimistic comment cannot be shown as sending.
- [ ] **QL-w02-19**: Comment author.is_following is always null because the comment ports take no viewer; the spec is silent.
- [ ] **QL-w02-20**: W02-01 is named 'contracts' but built entities and row mappers; the task spec_refs list 4 features while the wave plan delivers 8.

## Issues & Limitations
- [ ] **QL-w02-06** (`F-INFRA-04`, `infra`): Docker is not available in the validation sandbox, so the slot-2 compose stack (`yd-insta-w02`, web 21040, api 21041) was only rendered, not started, and the browser flow (`/create` → `/p/:id`) was not clicked through. Substitute evidence: a live API smoke run on port 21041 against PostgreSQL 16 (3-media post, re-use 422, 11 media 400, like ×2 + self-like, likers, comment + blank 400, edit 403/200, comment delete 403/204, post delete 403/204, then 404 on read/like/comment, `posts_count` 1 → 0, 2 notifications in SQL).
  - Suggested fix: Owner runs check-guide steps 5–12 on a Docker host before landing.
- [ ] **QL-w02-07** (`F-INFRA-05`, `infra`): As in QL-w01-06, the rendered `.yardos/waves/w02/.env.wave` has no `POSTGRES_PASSWORD`, so `compose-wave.mjs --up` fails unless it is exported in the calling shell.
  - Suggested fix: `export POSTGRES_PASSWORD=$(openssl rand -hex 16)` before `up`; the deploy skill should generate it.
- [ ] **QL-w02-08** (`F-INFRA-04`, `infra`): `.yardos/` is gitignored, so `.yardos/waves/w02/review-packet.json` and the compose bundle exist only in the validator's working tree, not on the wave branch.
  - Suggested fix: Orchestrator reads the packet from the job worktree, or un-ignore `.yardos/waves/*/review-packet.json`.
- [ ] **QL-w02-09** (`F-DB-04`, `persistence`): Keyset cursors encode `created_at` with millisecond precision (`Date.toISOString`), while the `posts`/`comments`/`post_likes` columns default to `now()` with microsecond precision. All API writes take `created_at` from the injected `Clock` (millisecond values), so API-created rows page correctly, but rows written with the SQL default (seed scripts, manual SQL) can be duplicated (comments, ascending) or skipped (posts/likers, descending) at a page boundary when they share a millisecond. The w03 follows list fixed the same issue with `date_trunc('milliseconds', created_at)`.
  - Suggested fix: Apply one convention across waves: either truncate in SQL like follows, or make the seed and factories always pass millisecond timestamps (record it in persistence/02).
- [ ] **QL-w02-10** (`F-DB-04`, `infra`): The sandbox has no Docker or system Postgres; integration tests ran on a throwaway PostgreSQL 16 cluster (embedded-postgres binaries, `initdb -A trust`, port 55434). All 168 integration tests pass; CI on `postgres:16-alpine` stays authoritative.
  - Suggested fix: Confirm the CI integration job is green on the wave branch.
- [ ] **QL-w02-11** (`F-FE-04`, `frontend`): There is no Playwright E2E suite yet (scheduled for w07), so the composer, post detail, like, comment and post-menu flows are covered only by component/hook tests with a mocked API.
  - Suggested fix: Add the w02 flows (create 3-media post, like, comment, edit, delete) to the w07 E2E plan.
- [ ] **QL-w02-12** (`F-BE-08`, `backend`): `GET /notifications` is not implemented yet (w06), so like/comment notifications written by w02 can only be checked in SQL during preview.
  - Suggested fix: None for w02; w06 integration tests should cover notifications created by likes and comments.
- [ ] **QL-w02-13** (`F-FE-04`, `frontend`): `PostGrid` and the `PostCard` feed mode (muted autoplay, "View all N comments") are built and unit-tested but not mounted on any page until the w05 profile/feed pages.
  - Suggested fix: Verify visually in w05.
- [x] **QL-w02-14** (`F-BE-04`, `backend`): Acceptance criterion "events are published only after commit" had no LikeService/CommentService test for a failure after events were collected, and `INV-05` ("verified by an integration test that recomputes them") had no recompute test for `like_count`/`comment_count`; W02-05 added two unit tests and one integration test.
- [ ] **QL-w02-21**: No Docker in the sandbox: the slot-2 stack was rendered, not started, and the browser flow was not clicked through; a live API smoke run on port 21041 was used instead.
- [ ] **QL-w02-22**: .env.wave lacks POSTGRES_PASSWORD; it must be exported before compose up.
- [ ] **QL-w02-23**: .yardos/ is gitignored, so review-packet.json and the compose bundle are not on the wave branch.
- [ ] **QL-w02-24**: Keyset cursors keep ms precision while DB now() defaults store µs; rows from seeds or raw SQL can repeat or be skipped at page boundaries (API writes are safe).
- [ ] **QL-w02-25**: Integration tests ran on a throwaway local PostgreSQL 16 cluster; CI on postgres:16-alpine is authoritative.
- [ ] **QL-w02-26**: No Playwright E2E yet (w07); composer, post page, like and comment flows have only component/hook tests.
- [ ] **QL-w02-27**: GET /notifications is not implemented (w06); like/comment notifications can only be checked in SQL.
- [ ] **QL-w02-28**: PostGrid and PostCard feed mode are not mounted on any page until w05.
- [x] **QL-w02-29**: Missing rollback/no-publish tests and INV-05 recompute test were added in W02-05.
- [ ] **QL-w02-31** (`F-DB-04`, `infra`): The W02-LAND-R1 landing sandbox has no Docker or PostgreSQL, so the 11 integration test files (`npm run test:integration`) could not run during landing; build, typecheck, lint, spec validation and all unit tests (397 api + 47 web) passed on the merged tree. The wave branch already contained `main` (merge-base = `main` tip), so the landing merge brings no new code from `main`.
  - Suggested fix: Confirm the CI integration job (`postgres:16-alpine`) is green on `main` after the `wave-02` tag.

## Open Questions
- [ ] **QL-w02-15** (`F-ECOMM-06`, `backend`): Should a comment notification be removed when its comment is soft-deleted? The current behaviour keeps the row and relies on the notification list hiding it (external-communication/04), while unliking deletes the like notification.
  - Suggested fix: Owner confirms; keep the current spec behaviour until then.
- [ ] **QL-w02-30**: Should a comment notification be removed when its comment is soft-deleted? It is currently kept and hidden by the notification list.
