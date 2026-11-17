# W05 — Search (users & hashtags) and hashtag pages

- **Wave:** `w05` · branch `wave/w05-search-hashtags` from `main` after `w02` lands · depends on: `w02` · runs concurrently with `w03`, `w04`
- **Preview:** slot 5 → web `21100`, api `21101` (`yd-insta-w05`)
- **Exact `owned_paths`:** see `w05` in [WAVE_MANIFEST.json](../WAVE_MANIFEST.json)
- **Specs:** [external-communication/06 (search)](../../specs/external-communication/06-feed-search-notifications-api.md); SearchService in backend/02; index catalog in persistence/02; `/search`, `/tags/:tag` in frontend/01

## Goal

Add user search by username/full name (prefix + trigram, ranked as the external spec says), hashtag prefix search with post counts, a paginated hashtag post list, and the search and hashtag pages.

## Tasks

| Task | Kind | Scope | Spec refs |
|---|---|---|---|
| W05-01 | contracts | Re-check `dto/search.ts` and the `SearchQueries` port. Raw-SQL `search-fixtures.ts` (users with varied names, posts with hashtags). | F-ECOMM-10 |
| W05-02 | worker | `SearchService` (`hashtagPosts` uses w02 `FeedQueries.byHashtag`), `search.row-mapper.ts`, `search.pg-repository.ts`, `search.routes.ts`, `search.dto-mapper.ts`. | F-BE-07, F-ECOMM-10, F-DB-03 |
| W05-03 | worker | `components/search` (SearchBox with 250 ms debounce, result list), `SearchPage`, `HashtagPage`, `state/search.ts`, `state/mappers/search.ts`. | F-FE-08 |
| W05-04 | validate | wave-validate ×2; `w05-check.md`, `w05-gaps.md`, review packet. | — |

## Acceptance criteria

- `q` lengths: users 1–50, hashtags 1–64. `limit` 1–30. Violations → `400`.
- User results follow the ranking rules in the external spec and include `is_following` for a signed-in viewer.
- `EXPLAIN` uses `users_username_prefix_idx` / trigram GIN indexes and `post_hashtags_tag_idx`.
- The hashtag post list returns `post_count` and keyset-paged `PostResponseDto`s, mapped with the w02 `post.dto-mapper.ts`, which this wave only reads.
- Web: debounced search shows users and hashtags together, keyboard navigation works, and the hashtag page shows a header with the count plus a `PostGrid` with infinite loading.

## Tests required

Unit: service input normalisation, mapper round-trips, `toHashtagResultVM` subtitles. Integration: each endpoint (happy, `400`), ranking order, `EXPLAIN` checks.

## Cross-wave notes

- Runs at the same time as w03 and w04. Edits nothing outside the `w05` `owned_paths`. `FeedQueries.byHashtag` (w02) is only read.
