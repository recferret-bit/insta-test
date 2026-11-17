# W05 — Home Feed, Explore, Search, Hashtags & Profile Page

| Field | Value |
|---|---|
| Wave | `w05` (`discovery`) |
| Depends on | `w02`, `w03`, `w04` |
| Runs concurrently with | `w06` (disjoint `owned_paths`) |
| Branch | `wave/w05-discovery` from `main` (after w02, w03, w04 land) |
| Compose | `yd-insta-w05`, slot 5, ports 21100–21119 (web 21100, api 21101) |
| Migrations | none (index gaps → `w05-gaps.md`, fixed by w07 `0002_hardening.sql`) |
| Spec refs | `F-BE-07`, `F-DB-03`, `F-ECOMM-09`, `F-ECOMM-10`, `F-FE-03`, `F-FE-06`, `F-FE-08`, `F-CORE-03` |

## Goal

Content discovery: a fan-out-on-read home feed (followees ∪ self), explore (everyone except the viewer), ranked user
search, hashtag search and hashtag post lists, all with keyset pagination. Web: `HomePage` (story tray + infinite feed),
`ExplorePage`, `SearchPage`, `HashtagPage` and the full `ProfilePage`, composed from w02–w04 components.

## Specs to Read First

`DEC-09`, `DEC-10`; `backend/02` (FeedService, SearchService), `backend/03` (FeedQueries, SearchQueries);
`external-communication/06` (feed, explore, search); `persistence/02` (index catalog, key queries);
`frontend/01` (`/`, `/explore`, `/search`, `/tags/:tag`, `/u/:username`), `frontend/02`, `frontend/03`.

## Endpoints in Scope

| Endpoint | Route file | Task |
|---|---|---|
| `GET /feed`, `GET /explore` | `feed.routes.ts` | W05-02 |
| `GET /search/users`, `GET /search/hashtags`, `GET /hashtags/{tag}/posts` | `search.routes.ts` | W05-03 |

## Task DAG

```text
W05-01 (contracts) ──┬── W05-02 Feed, explore & hashtag-post queries
                     ├── W05-03 Search & hashtags API
                     └── W05-04 Web home/explore/search/hashtag/profile pages
                                └──► W05-05 validate
```

### W05-01 — Freeze search DTOs & read models (`contracts`)

Confirm `dto/search.ts`; declare hashtag result / hashtag page read models in `search/views.ts` and any feed helpers in
`feed/views.ts` (ports stay as frozen in w00); web search VM mappers + tests.

### W05-02 — Feed, explore & hashtag-post queries (`worker`)

- `FeedService.homeFeed/explore`; `feed.pg-repository.ts` implementing `FeedQueries.homeFeed`, `explore`, `byHashtag`
  (+ `post_count`), all `LIMIT n+1` keyset on `(created_at, id)` and batched `PostView` hydration (import the w02
  hydration function from `posts.pg-repository.ts` instead of copying it; `posts.*` is not owned by this wave, so if the
  function is not exported, record a gap in `w05-gaps.md` and use a local copy until w07).
- Tampered cursor → `400 VALIDATION_FAILED`. `EXPLAIN` tests on seeded data: `posts_author_feed_idx`, `posts_recent_idx`,
  `post_hashtags_tag_idx`.

### W05-03 — Search & hashtags API (`worker`)

- `SearchService.searchUsers` (lowercase, strip `@`; rank 1 username prefix, rank 2 full-name word prefix, rank 3
  trigram ≥ 0.3; then `followers_count DESC`; top `limit`), `searchHashtags` (strip `#`, prefix on live posts, `post_count DESC`),
  `hashtagPosts` via the `FeedQueries.byHashtag` port; unknown tag → `200` empty with `post_count: 0`.
- Unit tests with a fake `FeedQueries`; the hashtag-posts integration test turns green once W05-02 is merged (W05-05).

### W05-04 — Web discovery pages (`worker`)

- `HomePage`: `StoryTray` (w04) + `FeedList` (infinite query, `IntersectionObserver` sentinel, skeletons, empty state
  linking Explore), rendering `PostCard` (w02).
- `ExplorePage` and `HashtagPage` (header with tag + post count) using `PostGrid` (w02), infinite scroll.
- `SearchPage`: `SearchBox` debounced 250 ms, `SearchResults` with users (`UserRow` + `FollowButton`) and hashtags.
- `ProfilePage`: `ProfileHeader` (avatar with story ring → `/stories/:username`, compact counters, full name, bio,
  `FollowButton` or "Edit profile"), post grid, nested `FollowListModal` routes (w03). Hooks `state/feed*`, `search*`, `profile*`.

### W05-05 — Validate (`validate`)

2-iteration `wave-validate` incl. EXPLAIN tests; compose preview on slot 5 (seed two users, check feed, explore, search, profile).

## Acceptance Criteria

- Each endpoint: happy path, `400` (bad cursor / bad `q`), and `401` for `/feed`; contract-parsed responses.
- Feed contains own + followees' live posts only, newest first, stable across pages while new posts are inserted.
- Explore excludes viewer's posts; anonymous explore works.
- Search ranking matches the spec on a fixture set; hashtag search ignores deleted posts.
- Web: infinite scroll, debounce, empty states and profile self/other variants covered by tests.

## Out of Scope

Ranking/recommendations (`Q-08`). Notifications and live updates (w06).
