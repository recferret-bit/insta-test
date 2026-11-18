# Wave w03 — Gaps, Issues & Open Questions

> Automatically saved during wave validation (`wave-validate`) and compiled into `docs/questions-and-limitations/GAPS_AND_QUESTIONS.md` when the wave lands on `main`.

## Gaps
- [ ] **QL-w03-01** (`F-ECOMM-07`, `external-communication`): The external-communication/04 mapping table lists a `FollowCommand { followerId, followeeUsername }` for the path `username`, but backend/02 defines `follow(followerId, username)` / `unfollow(followerId, username)` and the route passes the username inline; no `FollowCommand` type exists.
  - Suggested fix: Drop `FollowCommand` from the external-communication/04 mapping table (or note "no command object, inline args").
- [ ] **QL-w03-02** (`F-ECOMM-07`, `external-communication`): The follow endpoints answer `400 VALIDATION_FAILED` for a path `username` over 30 characters (`UsernameParamsDto`), but external-communication/04 lists only `401, 404, 422` for `PUT` and `401, 404` for `DELETE`. Usernames within the length limit but with invalid characters return `404 NOT_FOUND`, the same as `GET /users/{username}`.
  - Suggested fix: Add `400` to the follow rows of the endpoint table, or state the path-param rule once in external-communication/01.
- [ ] **QL-w03-03** (`F-ECOMM-07`, `external-communication`): `DELETE /users/{username}/follow` on yourself returns `200 { following: false }` (idempotent no-op) instead of `422 CANNOT_FOLLOW_SELF`; external-communication/04 and backend/02 do not say which applies.
  - Suggested fix: Add "DELETE on self is a 200 no-op" to the Follows behaviour list.
- [ ] **QL-w03-04** (`F-FE-06`, `frontend`): frontend/02 names only `patchPostInCaches` for optimistic updates; the follow mutation needs profile and user-summary patchers (`patchUserSummariesInCaches`, `patchUserSummaryData` in `state/follows.ts`), which the spec does not name.
  - Suggested fix: Add a profile/user-summary cache-patch helper next to `patchPostInCaches` in frontend/02.
- [x] **QL-w03-16**: Duplicate of QL-w03-01 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-01 instead.
- [x] **QL-w03-17**: Duplicate of QL-w03-02 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-02 instead.
- [x] **QL-w03-18**: Duplicate of QL-w03-03 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-03 instead.
- [x] **QL-w03-19**: Duplicate of QL-w03-04 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-04 instead.

## Issues & Limitations
- [ ] **QL-w03-05** (`F-INFRA-04`, `infra`): Docker is not available in the validation sandbox, so the slot-3 compose stack (`yd-insta-w03`, web 21060, api 21061) was only rendered, not started. Substitute evidence: a live API run on port 21061 against PostgreSQL 16.13. Two accounts followed each other; the run covered idempotent re-follow with a different case, self-follow 422, 404, anonymous 401, `is_following` on the profile, both lists, unfollow twice, a bad cursor 400, and the notification row removed on unfollow. No passwords appeared in the logs.
  - Suggested fix: Owner runs check-guide steps 5–10 on a Docker host before landing.
- [ ] **QL-w03-06** (`F-FE-06`, `frontend`): `FollowButton` and `FollowListModal` are not mounted anywhere yet. `ProfilePage` is still the w00 placeholder (page composition is in w05), so `/u/:username/followers|following` shows placeholder text and the follow UI cannot be clicked through in a browser in w03. Only the component and hook tests (28 tests, mocked API) cover it.
  - Suggested fix: Mount both in `ProfilePage` in w05 and add the browser check to the w05 guide.
- [ ] **QL-w03-07** (`F-BE-05`, `persistence`): The follower/following list query sorts and pages on `date_trunc('milliseconds', f.created_at)` so that the ISO cursor round-trips exactly. As a result, `follows_followee_idx` / `follows_follower_idx` `(…, created_at DESC)` only narrow rows by owner; they cannot provide the order or the keyset seek. Every page sorts all of that owner's relations, which is slow for accounts with very many followers.
  - Suggested fix: Store `created_at` truncated to milliseconds (DB default `date_trunc('milliseconds', now())`), or carry microseconds in the cursor, then sort on the raw column.
- [ ] **QL-w03-08** (`F-INFRA-05`, `infra`): As in QL-w01-06, the rendered `.yardos/waves/w03/.env.wave` has no `POSTGRES_PASSWORD`, so `compose-wave.mjs --up` fails unless it is exported in the calling shell.
  - Suggested fix: `export POSTGRES_PASSWORD=$(openssl rand -hex 16)` before `up` (check-guide step 5); the deploy skill should generate it.
- [ ] **QL-w03-09** (`F-INFRA-04`, `infra`): `.yardos/` is gitignored, so `.yardos/waves/w03/review-packet.json` and the compose bundle exist only in the validator's working tree and are not part of the wave branch.
  - Suggested fix: Orchestrator reads the packet from the job worktree, or un-ignore `.yardos/waves/*/review-packet.json`.
- [ ] **QL-w03-10** (`F-DB-04`, `infra`): The sandbox has no Docker or system Postgres. Integration tests ran on a local PostgreSQL 16.13 started with `initdb`/`pg_ctl` under `$HOME`. All 134 integration tests pass; CI on `postgres:16-alpine` remains the authoritative run.
- [ ] **QL-w03-11** (`F-FE-06`, `frontend`): There is no Playwright E2E suite yet (`apps/web/e2e` is absent; scheduled for w07).
- [x] **QL-w03-12** (`F-CORE-03`, `specs`): `apps/api/test/unit/mappers/follows.row-mapper.test.ts` (W03-01) failed `npm run format:check`. Fixed in W03-04 with `prettier --write`.
- [x] **QL-w03-13** (`F-DB-04`, `persistence`): The wave acceptance criteria require `400` integration tests for every endpoint and "re-follow creates exactly one notification"; `PUT`/`DELETE …/follow` had no `400` test and re-follow was not covered. Added 3 tests in W03-04 (`apps/api/test/integration/social/follows.test.ts`).
- [x] **QL-w03-20**: Duplicate of QL-w03-05 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-05 instead.
- [x] **QL-w03-21**: Duplicate of QL-w03-06 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-06 instead.
- [x] **QL-w03-22**: Duplicate of QL-w03-07 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-07 instead.
- [x] **QL-w03-23**: Duplicate of QL-w03-08 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-08 instead.
- [x] **QL-w03-24**: Duplicate of QL-w03-09 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-09 instead.
- [x] **QL-w03-25**: Duplicate of QL-w03-10 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-10 instead.
- [x] **QL-w03-26**: Duplicate of QL-w03-11 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-11 instead.
- [x] **QL-w03-27**: Duplicate of QL-w03-12 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-12 instead.
- [x] **QL-w03-28**: Duplicate of QL-w03-13 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-13 instead.

## Open Questions
- [ ] **QL-w03-14** (`F-CORE-01`, `specs`): The W03-04 task lists spec refs `F-BE-05`, `F-ECOMM-07`, but the wave plan (docs/plan/waves/W03-social-graph.md) also covers `F-ECOMM-03` (`is_following`), `F-FE-06` (follow button and lists), `F-CORE-03` and `F-DB-04`, all of which were delivered. Should the task `spec_refs` in WAVE_MANIFEST.json match the wave plan?
- [ ] **QL-w03-15** (`F-CORE-01`, `specs`): As in QL-w01-03, the `Follow` / `FollowState` entity tests live in `apps/api/test/unit/mappers/follows.entity.test.ts` because there is no `owned_paths` prefix for domain-entity unit tests. Should `apps/api/test/unit/domain/<module>/` be added?
- [x] **QL-w03-29**: Duplicate of QL-w03-14 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-14 instead.
- [x] **QL-w03-30**: Duplicate of QL-w03-15 (short restatement added when the W03-04 review summary was merged); closed in W03-VAL-2 Round 1, track QL-w03-15 instead.
