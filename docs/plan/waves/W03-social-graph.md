# W03 — Follows & Social Graph

| Field | Value |
|---|---|
| Wave | `w03` (`social-graph`) |
| Depends on | `w01` |
| Runs concurrently with | `w02`, `w04` (disjoint `owned_paths`) |
| Branch | `wave/w03-social-graph` from `main` (after w01 lands) |
| Compose | `yd-insta-w03`, slot 3, ports 21060–21079 (web 21060, api 21061) |
| Migrations | none |
| Spec refs | `F-BE-05`, `F-ECOMM-03` (`is_following`), `F-ECOMM-07`, `F-FE-06` (follow button + lists), `F-CORE-03`, `F-DB-04` |

## Goal

Directed follow relationships: idempotent follow/unfollow by username, both counters updated in one transaction with a
deterministic lock order, follow notifications (created on follow, deleted on unfollow), and followers / following
cursor lists. Web: `FollowButton` and `FollowListModal`, used by the profile page in w05.

## Specs to Read First

ENT-Follow in `specs/03`; `INV-01`, `INV-05`; `backend/02` (FollowService), `backend/03` (FollowRepository,
`UserRepository.adjustCounters`); `external-communication/04` (follows part); `frontend/01` (`/u/:username/followers|following`).

## Endpoints in Scope (`social.routes.ts`)

`PUT /api/v1/users/{username}/follow`, `DELETE /api/v1/users/{username}/follow`,
`GET /api/v1/users/{username}/followers`, `GET /api/v1/users/{username}/following`.

## Task DAG

```text
W03-01 (contracts) ──┬── W03-02 Follows API
                     └── W03-03 Web follow button & lists
                                └──► W03-04 validate
```

### W03-01 — Freeze follow entity & mappers (`contracts`)

- Confirm `FollowStateResponseDto` / follow list item DTOs in `dto/users.ts`.
- `Follow.create` (self → `CANNOT_FOLLOW_SELF`), `FollowState`, relation list view; `FollowRow` mappers + round-trip test.

### W03-02 — Follows API (`worker`)

- `FollowService.follow/unfollow`: resolve followee (`404`), insert-if-absent / delete-if-present; when changed, update
  `followers_count` of followee and `following_count` of follower via `adjustCounters` locking both user rows `ORDER BY id`;
  follow notification `insertIfAbsent` / `deleteFor`; events `UserFollowed`, `NotificationCreated`.
- `listFollowers` / `listFollowing`: newest first, keyset on `(created_at, follower/followee id)`, `is_following` for viewer.
- `follows.pg-repository.ts` using `follows_followee_idx` / `follows_follower_idx`.

### W03-03 — Web follow button & lists (`worker`)

- `FollowButton`: optimistic toggle, patches `["profile", username]` and user-summary entries, rollback + toast on error,
  hidden for self and when logged out (links to login).
- `FollowListModal`: route-driven modal for `/u/:username/followers|following`, infinite list of `UserRow` + `FollowButton`,
  focus trap, `Esc` closes back to the profile.
- Hooks `state/follows*`.

### W03-04 — Validate (`validate`)

2-iteration `wave-validate`; compose preview on slot 3 (two accounts follow each other; counters and lists update).

## Acceptance Criteria

- Each endpoint: happy path, `401`, `400` integration tests with contract-parsed responses; unknown user → `404`.
- Self-follow → `422 CANNOT_FOLLOW_SELF` (`INV-01`); repeated follow/unfollow is idempotent and counters stay exact.
- Concurrent mutual follows (A→B and B→A in parallel) finish without deadlock; counters equal source rows (`INV-05`).
- `GET /users/{username}` returns `is_following = true` after follow, `null` for self/anonymous.
- Unfollow deletes the follow notification; re-follow creates exactly one.
- Web: optimistic toggle + rollback tests; modal keyboard behaviour.

## Out of Scope

Profile page composition (w05), notification list / live push (w06).
