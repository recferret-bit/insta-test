# Wave w03 — Follows & Social Graph: Owner Check Guide

Branch `wave/w03-social-graph` · compose project `yd-insta-w03` · slot 3 · web `http://localhost:21060` · api `http://localhost:21061`
(proxy URLs: `http://w03--insta.apps.localhost:9080`, `http://api--w03--insta.apps.localhost:9080`).

## Executive Summary

W03 adds directed follow relationships. Users can follow and unfollow other users by username. Both calls are
idempotent: repeating one changes nothing and emits no events, and following yourself is rejected with
`422 CANNOT_FOLLOW_SELF` (`INV-01`). When a follow is actually created or removed, one transaction updates the
followee's `followers_count` and the follower's `following_count`. The two user rows are updated in ascending id order,
so parallel mutual follows cannot deadlock and the counters always match the `follows` rows (`INV-05`). A follow creates
one `follow` notification (`UserFollowed` and `NotificationCreated` events are emitted after commit); an unfollow deletes it.
The followers and following lists are public. They return the newest relation first, use cursor pages with `followed_at`,
and include `is_following` for the viewer (`null` for anonymous viewers and for yourself).
`GET /users/{username}` now reports the real `is_following`. On the web, `FollowButton` is an optimistic toggle: it
updates the profile, `me` and user-summary caches, and rolls back with a toast on error. `FollowListModal` is a
route-driven list with infinite scroll; the profile page mounts both in w05.

### Round 1 re-validation (W03-VAL-2, after syncing `main` with w02 in `d24ba53`)

W03-SYNC-1 merged `main` (w02 posts, likes and comments) into the wave. W03-VAL-2 ran every check again on the merged tree:

| Check | Result |
|---|---|
| Wave audit (`validate-wave.mjs --require-guide`) | `ok`, no errors or warnings |
| Spec validation (`validate-specs.mjs`) | `valid: true` |
| `npm run typecheck` / `npm run lint` / `npm run format:check` | pass |
| Unit tests (`npm test`) | contracts 47, api 421, web 425, all pass |
| Integration tests (PostgreSQL 16.13) | 185 / 185 pass in 12 files (social/follows 17) |
| E2E | none yet (Playwright scheduled for w07) |

Iteration 1 checked the code the merge brought in against the follows code. The merge changed no follows, users or
notifications source files. `PostService` updates only the author's user row in each transaction, so it cannot
deadlock with the ascending-id lock order that follows use. Layering, mapper use and file sizes are unchanged, and no
code defects were found. Iteration 2 found that the ledger held 15 short duplicates (`QL-w03-16..30`) of
`QL-w03-01..15`, added when the W03-04 review summaries were merged. They are now closed as duplicates and their IDs
are kept. There are no new open items.

### W03-04 validation (2 iterations) results

| Check | Result |
|---|---|
| Wave audit (`validate-wave.mjs`) | `ok`, no errors or warnings |
| `npm run typecheck` / `npm run lint` | pass |
| `npm run format:check` | failed on 1 W03-01 test file; fixed (QL-w03-12), now passes |
| Unit tests (`npm test`) | contracts 47, api 305, web 353, all pass |
| Integration tests (`npm run test:integration`, PostgreSQL 16.13) | 134 / 134 pass (social 17, 3 added in W03-04) |
| E2E | none yet (Playwright scheduled for w07) |
| Live API run on port 21061 (two accounts follow each other) | every status, body, counter and notification as expected |
| Compose preview slot 3 | rendered only; no Docker in the sandbox (QL-w03-05) |

Iteration 1 checked the code against specs (external-communication/04, backend/02, backend/03,
persistence/02-03, frontend/01-02). It found no layering (`api → domain ← data`), row-leak, size-cap (largest file 292
lines), duplication or stray-file defects. It fixed one formatting failure and added the missing acceptance tests: `400`
on `PUT`/`DELETE …/follow` and re-follow creating exactly one notification. Iteration 2 recorded the ledger below.

## Delivered Features

- `F-BE-05` — `FollowService` (follow, unfollow, listFollowers, listFollowing) and `PgFollowRepository`
- `F-ECOMM-07` — `PUT|DELETE /api/v1/users/{username}/follow`, `GET /api/v1/users/{username}/followers|following`
- `F-ECOMM-03` — `is_following` on `GET /api/v1/users/{username}`
- `F-FE-06` — `FollowButton`, `FollowListModal`, `state/follows` (follow mutation and follow-list hooks); not mounted until w05
- `F-CORE-03` — ENT-Follow (`Follow.create`, `FollowState.of`) with DTO ↔ Business ↔ Row mappers
- `F-DB-04` — follows integration tests against real PostgreSQL

## Step-by-Step Verification Guide

### Step 1 — Static gates and unit tests (`F-CORE-03`, `F-FE-06`)

- **Where:** repository root on `wave/w03-social-graph`.
- **How:** `npm ci && npm run typecheck && npm run lint && npm run format:check && npm test`
- **Expected:** every command exits 0. Vitest reports contracts 47, api 421 and web 425 tests passed, including `follows.entity`, `follows.row-mapper`, `follow.service`, `social.dto-mapper`, `FollowButton`, `FollowListModal` and `state/follows`.

### Step 2 — Integration tests on PostgreSQL 16 (`F-DB-04`, `F-ECOMM-07`, `F-BE-05`)

- **Where:** repository root, with a disposable PostgreSQL 16 database (it is wiped).
- **How:** `docker run -d --rm --name w03-pg -e POSTGRES_PASSWORD=pg -p 55432:5432 postgres:16-alpine` then
  `TEST_DATABASE_URL=postgres://postgres:pg@localhost:55432/postgres npm run test:integration`
- **Expected:** `Test Files 12 passed`, `Tests 185 passed`. `test/integration/social/follows.test.ts` passes 17 tests, including 15 rounds of parallel mutual follow/unfollow with no deadlock, duplicate concurrent follows counted once, and cursor pages with no gaps or duplicates.

### Step 3 — Wave audit and spec validation

- **Where:** repository root.
- **How:** `node .yardos/skills/wave-validate/scripts/validate-wave.mjs --root . --wave w03 --require-guide --json` and
  `node .agents/skills/spec-architect/scripts/validate-specs.mjs --root . --json`
- **Expected:** `"ok": true` with empty `errors`, and `gaps_file_path` is `docs/questions-and-limitations/w03-gaps.md`; the spec validator reports `"valid": true`.

### Step 4 — Render the slot-3 compose bundle (`F-INFRA-04`)

- **Where:** repository root.
- **How:** `node .yardos/skills/wave-compose-deploy/scripts/compose-wave.mjs --root . --project insta --wave w03 --slot-index 3 --render-only --json`
- **Expected:** `"compose_project": "yd-insta-w03"`, `"port_base": 21060`, web → `21060`, api → `21061`; `.yardos/waves/w03/compose.wave.yml` publishes no host port for `db`.

### Step 5 — Start the w03 stack

- **Where:** a Docker host, at the repository root.
- **How:** create `.yardos/waves/w03/compose.local.yml` with
  `services: { api: { environment: { PUBLIC_URL: "http://localhost:21060", PUBLIC_API_URL: "http://localhost:21061", CORS_ORIGIN: "http://localhost:21060" } }, web: { environment: { PUBLIC_URL: "http://localhost:21060", PUBLIC_API_URL: "http://localhost:21061" } } }`
  then run
  `export POSTGRES_PASSWORD=$(openssl rand -hex 16) && docker compose --project-directory . -p yd-insta-w03 -f .yardos/waves/w03/compose.base.yml -f .yardos/waves/w03/compose.wave.yml -f .yardos/waves/w03/compose.local.yml --env-file .yardos/waves/w03/.env.wave up -d --build --wait`
  (skip the override when testing through the Hoster proxy).
- **Expected:** exits 0 with `db`, `api`, `web` all `Healthy`; `curl http://localhost:21061/api/v1/health` → `200 {"status":"ok","db":"ok",…}`.

### Step 6 — Two accounts follow each other (`F-ECOMM-07`, `F-BE-05`)

- **Where:** `PUT http://localhost:21061/api/v1/users/{username}/follow`
- **How:** sign up `alice` and `carol` (`POST /api/v1/auth/signup`, keep tokens `$A`, `$C`); then
  `curl -s -X PUT localhost:21061/api/v1/users/carol/follow -H "authorization: Bearer $A"`, then
  `curl -s -X PUT localhost:21061/api/v1/users/alice/follow -H "authorization: Bearer $C"`, then repeat the first call with `CAROL`.
- **Expected:** each call returns `200 {"user_id":"usr_…<followee>","following":true,"followers_count":1}`. The repeat returns the same body and changes nothing. Both users have `followers_count = 1` and `following_count = 1`. The `follows` table has 2 rows, and `notifications` has exactly 2 `type = 'follow'` rows (one per recipient).

### Step 7 — Errors: self, unknown, anonymous, invalid (`F-ECOMM-07`, `INV-01`)

- **Where:** `PUT|DELETE http://localhost:21061/api/v1/users/{username}/follow`
- **How:** with `$A`: `PUT …/users/alice/follow`; `PUT …/users/nobody/follow`; `PUT …/users/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/follow` (31 chars); without a token: `PUT …/users/carol/follow`.
- **Expected:** `422 CANNOT_FOLLOW_SELF`, `404 NOT_FOUND`, `400 VALIDATION_FAILED`, `401 UNAUTHENTICATED`, each with an `ErrorResponseDto` body and `request_id`. No counters change.

### Step 8 — `is_following` on the profile (`F-ECOMM-03`)

- **Where:** `GET http://localhost:21061/api/v1/users/carol`
- **How:** call it with `$A`, anonymously, and with `$C`.
- **Expected:** with `$A` → `is_following: true`, `followers_count: 1`; anonymous and self (`$C`) → `is_following: null`.

### Step 9 — Followers / following lists and paging (`F-ECOMM-07`, `F-BE-05`)

- **Where:** `GET http://localhost:21061/api/v1/users/carol/followers` and `…/users/alice/following?limit=1`
- **How:** call the followers list anonymously, call the following list with `$C`, then call `…/followers?cursor=bad` and `…/following?limit=51`.
- **Expected:** `200 {"items":[{"id":"usr_…","username":"alice",…,"is_following":null,"followed_at":"<ISO>"}],"next_cursor":null}`, newest relation first. In the following list `carol` sees herself with `is_following: null`. A bad cursor and `limit=51` return `400 VALIDATION_FAILED`.

### Step 10 — Unfollow and re-follow (`F-ECOMM-07`, `F-BE-05`)

- **Where:** `DELETE http://localhost:21061/api/v1/users/carol/follow`
- **How:** with `$A`: `DELETE` twice, `GET /api/v1/users/carol`, then `PUT …/users/carol/follow` again; also `DELETE …/users/alice/follow` with `$A` (self).
- **Expected:** both deletes return `200 {"following":false,"followers_count":0}`. The profile then shows `is_following: false`, and alice's `following_count` drops to 0. The `follow` notification from alice to carol is deleted; the one from carol to alice remains. Re-following creates exactly one new notification. The self `DELETE` returns `200 {"following":false}` (no-op, QL-w03-03).

### Step 11 — Web follow button and list modal (`F-FE-06`)

- **Where:** `apps/web` component tests; in the browser `http://localhost:21060/u/carol/followers`.
- **How:** `npm test -w apps/web -- FollowButton FollowListModal follows`; then open the URL while logged in.
- **Expected:** the tests pass. They cover the optimistic toggle (clicks ignored while pending, then reconciled), rollback of every cache with a toast on error, only the global "Slow down" toast on 429, hiding the button for yourself, the login link with `?next` when signed out, `Esc` and the close button returning to `/u/carol` with focus starting inside the dialog, the empty and error states, and loading the next page by cursor (button and sentinel). In the browser the page shows the w00 placeholder ("Followers will appear here."), because `ProfilePage` mounts the modal only in w05 (QL-w03-06).

### Step 12 — Tear down

- **Where:** repository root.
- **How:** `docker compose -p yd-insta-w03 down -v` (or `compose-wave.mjs --root . --project insta --wave w03 --down --json`).
- **Expected:** containers, network and the `db-data`/`media` volumes of `yd-insta-w03` are removed; other wave stacks are untouched.

## Open Questions & Limitations

- [ ] **[gap] QL-w03-01** (`F-ECOMM-07`, `external-communication`): The external-communication/04 mapping table lists a `FollowCommand { followerId, followeeUsername }` for the path `username`, but backend/02 defines `follow(followerId, username)` / `unfollow(followerId, username)` and the route passes the username inline; no `FollowCommand` type exists.
- [ ] **[gap] QL-w03-02** (`F-ECOMM-07`, `external-communication`): The follow endpoints answer `400 VALIDATION_FAILED` for a path `username` over 30 characters (`UsernameParamsDto`), but external-communication/04 lists only `401, 404, 422` for `PUT` and `401, 404` for `DELETE`. Usernames within the length limit but with invalid characters return `404 NOT_FOUND`, the same as `GET /users/{username}`.
- [ ] **[gap] QL-w03-03** (`F-ECOMM-07`, `external-communication`): `DELETE /users/{username}/follow` on yourself returns `200 { following: false }` (idempotent no-op) instead of `422 CANNOT_FOLLOW_SELF`; external-communication/04 and backend/02 do not say which applies.
- [ ] **[gap] QL-w03-04** (`F-FE-06`, `frontend`): frontend/02 names only `patchPostInCaches` for optimistic updates; the follow mutation needs profile and user-summary patchers (`patchUserSummariesInCaches`, `patchUserSummaryData` in `state/follows.ts`), which the spec does not name.
- [ ] **[issue] QL-w03-05** (`F-INFRA-04`, `infra`): Docker is not available in the validation sandbox, so the slot-3 compose stack (`yd-insta-w03`, web 21060, api 21061) was only rendered, not started. Substitute evidence: a live API run on port 21061 against PostgreSQL 16.13. Two accounts followed each other; the run covered idempotent re-follow with a different case, self-follow 422, 404, anonymous 401, `is_following` on the profile, both lists, unfollow twice, a bad cursor 400, and the notification row removed on unfollow. No passwords appeared in the logs.
- [ ] **[issue] QL-w03-06** (`F-FE-06`, `frontend`): `FollowButton` and `FollowListModal` are not mounted anywhere yet. `ProfilePage` is still the w00 placeholder (page composition is in w05), so `/u/:username/followers|following` shows placeholder text and the follow UI cannot be clicked through in a browser in w03. Only the component and hook tests (28 tests, mocked API) cover it.
- [ ] **[issue] QL-w03-07** (`F-BE-05`, `persistence`): The follower/following list query sorts and pages on `date_trunc('milliseconds', f.created_at)` so that the ISO cursor round-trips exactly. As a result, `follows_followee_idx` / `follows_follower_idx` `(…, created_at DESC)` only narrow rows by owner; they cannot provide the order or the keyset seek. Every page sorts all of that owner's relations, which is slow for accounts with very many followers.
- [ ] **[issue] QL-w03-08** (`F-INFRA-05`, `infra`): As in QL-w01-06, the rendered `.yardos/waves/w03/.env.wave` has no `POSTGRES_PASSWORD`, so `compose-wave.mjs --up` fails unless it is exported in the calling shell.
- [ ] **[issue] QL-w03-09** (`F-INFRA-04`, `infra`): `.yardos/` is gitignored, so `.yardos/waves/w03/review-packet.json` and the compose bundle exist only in the validator's working tree and are not part of the wave branch.
- [ ] **[issue] QL-w03-10** (`F-DB-04`, `infra`): The sandbox has no Docker or system Postgres. Integration tests ran on a local PostgreSQL 16.13 started with `initdb`/`pg_ctl` under `$HOME`. All 134 integration tests pass; CI on `postgres:16-alpine` remains the authoritative run.
- [ ] **[issue] QL-w03-11** (`F-FE-06`, `frontend`): There is no Playwright E2E suite yet (`apps/web/e2e` is absent; scheduled for w07).
- [x] **[issue] QL-w03-12** (`F-CORE-03`, `specs`): `apps/api/test/unit/mappers/follows.row-mapper.test.ts` (W03-01) failed `npm run format:check`. Fixed in W03-04 with `prettier --write`.
- [x] **[issue] QL-w03-13** (`F-DB-04`, `persistence`): The wave acceptance criteria require `400` integration tests for every endpoint and "re-follow creates exactly one notification"; `PUT`/`DELETE …/follow` had no `400` test and re-follow was not covered. Added 3 tests in W03-04 (`apps/api/test/integration/social/follows.test.ts`).
- [ ] **[question] QL-w03-14** (`F-CORE-01`, `specs`): The W03-04 task lists spec refs `F-BE-05`, `F-ECOMM-07`, but the wave plan (docs/plan/waves/W03-social-graph.md) also covers `F-ECOMM-03` (`is_following`), `F-FE-06` (follow button and lists), `F-CORE-03` and `F-DB-04`, all of which were delivered. Should the task `spec_refs` in WAVE_MANIFEST.json match the wave plan?
- [ ] **[question] QL-w03-15** (`F-CORE-01`, `specs`): As in QL-w01-03, the `Follow` / `FollowState` entity tests live in `apps/api/test/unit/mappers/follows.entity.test.ts` because there is no `owned_paths` prefix for domain-entity unit tests. Should `apps/api/test/unit/domain/<module>/` be added?
