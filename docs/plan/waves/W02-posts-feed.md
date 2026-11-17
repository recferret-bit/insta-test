# W02 — Posts, home feed & explore

- **Wave:** `w02` · branch `wave/w02-posts-feed` from `main` after `w01` lands · depends on: `w01` · runs concurrently with `w04`
- **Preview:** slot 2 → web `21040`, api `21041` (`yd-insta-w02`)
- **Exact `owned_paths`:** see `w02` in [WAVE_MANIFEST.json](../WAVE_MANIFEST.json)
- **Specs:** `ENT-Post` in [03-domain-and-entity-map.md](../../specs/specs/03-domain-and-entity-map.md); [external-communication/03 (posts)](../../specs/external-communication/03-media-and-posts-api.md), [06 (feed & explore)](../../specs/external-communication/06-feed-search-notifications-api.md); `DEC-09`, `DEC-10`, `DEC-11`, `INV-03`, `INV-07`

## Goal

Publish posts with 1–10 ordered photos/videos and a caption with hashtags. Edit the caption, soft-delete posts, browse a profile grid, a home feed (followees + self) and explore. Includes the composer, post detail, home and explore pages.

## Tasks

| Task | Kind | Scope | Spec refs |
|---|---|---|---|
| W02-01 | contracts | Re-check `dto/posts.ts`, `PostRepository` and `FeedQueries` ports, and `post.row.ts`. Implement the pieces both backend workers use: `post.row-mapper.ts`, `post-view.query.ts` (batch PostView assembly without N+1), `post.dto-mapper.ts`. Raw-SQL `post-fixtures.ts`. | F-CORE-03, F-DB-04, F-ECOMM-05 |
| W02-02 | worker | `Post` entity, `hashtag.ts`, `PostService`, `post.pg-repository.ts`, `posts.routes.ts` (CRUD + `GET /users/{username}/posts`). | F-BE-03, F-ECOMM-05 |
| W02-03 | worker | `FeedService`, `feed.pg-repository.ts` (`homeFeed`, `explore`, `byHashtag` for w05), `feed.routes.ts`. | F-BE-07, F-ECOMM-09, F-DB-03 |
| W02-04 | worker | `HomePage`, `ExplorePage`, `CreatePostPage`, `PostPage`, `ui/components/posts`, `state/{posts,feed}.ts`, `state/mappers/posts.ts` (incl. `patchPostInCaches`). | F-FE-03, F-FE-04, F-FE-05, F-FE-08 |
| W02-05 | validate | wave-validate ×2; `w02-check.md`, `w02-gaps.md`, review packet. | — |

## Acceptance criteria

- `POST /posts`: 1–10 media owned by the author with purpose `post` and status `uploaded`. They become `attached`, positions run `0..n-1`, and `posts_count += 1` happens in the same tx. Bad media → `422 MEDIA_INVALID`.
- Hashtags are extracted with `#([\p{L}\p{N}_]{1,64})`, lowercased, deduplicated, max 30, and recomputed when the caption is edited.
- Only the author can edit or delete (`403`). Deleted posts return `404` everywhere and decrement `posts_count`.
- Feed and explore use keyset cursors on `(created_at, id)`. A tampered cursor → `400`. Inserts made during paging cause no duplicates or skips.
- `EXPLAIN` shows `posts_author_feed_idx` (profile grid/feed) and `posts_recent_idx` (explore).
- Web: infinite scroll with skeletons. The composer enforces its client-side limits, runs at most 3 parallel uploads with progress, and supports keyboard reordering. The post page shows a carousel with arrow keys, and edit/delete for the author. The like button and comment section come from the w00 stubs.

## Tests required

Unit: `Post.create`/`editCaption` invariants, hashtag extraction, mapper round-trips, cursor codec use, `toPostVM` caption tokens. Integration: every endpoint (happy, `401`, `400`, `403`/`404`), counter checks, pagination stability, `EXPLAIN` checks.

## Cross-wave notes

- `HomePage` renders `stories/StoryTray` through the w00 stub. w04 owns that file and works on it at the same time.
- `LikeButton` and `CommentSection` are owned by w03, which starts after this wave lands.
