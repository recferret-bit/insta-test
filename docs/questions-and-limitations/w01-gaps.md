# Wave w01 — Gaps, Issues & Open Questions

> Automatically saved during wave validation (`wave-validate`) and compiled into `docs/questions-and-limitations/GAPS_AND_QUESTIONS.md` when the wave lands on `main`.

## Gaps
- [ ] **QL-w01-01** (`F-ECOMM-04`, `external-communication`): `POST /api/v1/media` only reads text parts (`purpose`, `width`, `height`, `duration_ms`) that come before the `file` part; parts after the file are ignored, so a `duration_ms` sent after a video file returns `400 VALIDATION_FAILED`. external-communication/03 does not state this ordering rule (the web client `buildUploadForm` already appends fields first).
  - Suggested fix: Add "text parts MUST precede `file`; later parts are ignored" to the `UploadMediaRequest` table in external-communication/03.
- [ ] **QL-w01-02** (`F-ECOMM-02`, `external-communication`): `PATCH /api/v1/me` re-sending the user's current `avatar_media_id` is a `200` no-op instead of `422 MEDIA_INVALID` (the asset is already `attached`); external-communication/02 and backend/02 are silent on this case.
  - Suggested fix: Record the no-op rule in the external-communication/02 Behaviour list.
- [ ] **QL-w01-03** (`F-CORE-01`, `specs`): There is no `owned_paths` prefix for domain-entity unit tests, so `User`/`Session`/`MediaAsset`/`Notification` entity tests live in `apps/api/test/unit/mappers/*.entity.test.ts` (W01-01's first run failed with `owned_paths_violation` for this reason).
  - Suggested fix: Add `apps/api/test/unit/domain/<module>/` to the ownership prefixes in specs/01-project-structure.md and move the four files in a later wave.
- [ ] **QL-w01-04** (`F-CORE-01`, `specs`): The W01-06 task lists spec refs `F-BE-01`, `F-BE-02`, `F-ECOMM-02`, `F-ECOMM-04`, while the wave plan (docs/plan/waves/W01-identity-media.md) also covers `F-ECOMM-03`, `F-BE-08` (write side), `F-BE-09`, `F-FE-02`, `F-FE-07`, `F-CORE-03` and `F-DB-04`, all of which were delivered.
  - Suggested fix: Align the w01 task `spec_refs` in WAVE_MANIFEST.json with the wave plan.
- [ ] **QL-w01-15**: POST /api/v1/media only reads text parts that come before the file part; external-communication/03 does not document this ordering rule.
- [ ] **QL-w01-16**: PATCH /me re-sending the current avatar_media_id is a 200 no-op rather than 422 MEDIA_INVALID; the spec is silent.
- [ ] **QL-w01-17**: No owned_paths prefix for domain-entity unit tests; they live in apps/api/test/unit/mappers/*.entity.test.ts.
- [ ] **QL-w01-18**: The W01-06 task spec_refs list 4 features; the wave plan covers and delivered 11.

## Issues & Limitations
- [ ] **QL-w01-05** (`F-INFRA-04`, `infra`): Docker is not available in the validation sandbox, so the slot-1 compose stack (`yd-insta-w01`, web 21020, api 21021) was only rendered, not started, and the browser flow (signup → upload avatar → edit profile) was not clicked through. Substitute evidence: a live API smoke run on port 21021 against PostgreSQL 16.9 (signup, 409, identical 401s, avatar upload renamed `.mp4`, 415, PATCH /me, media serving headers, traversal 404, logout + token reuse 401, no secrets in logs) plus web component tests.
  - Suggested fix: Owner runs check-guide steps 5–13 on a Docker host before landing.
- [ ] **QL-w01-06** (`F-INFRA-05`, `infra`): As in QL-w00-07, the rendered `.yardos/waves/w01/.env.wave` has no `POSTGRES_PASSWORD`, so `compose-wave.mjs --up` fails unless it is exported in the calling shell.
  - Suggested fix: `export POSTGRES_PASSWORD=$(openssl rand -hex 16)` before `up` (check-guide step 5); the deploy skill should generate it.
- [ ] **QL-w01-07** (`F-INFRA-04`, `infra`): `.yardos/` is gitignored, so `.yardos/waves/w01/review-packet.json` and the compose bundle exist only in the validator's working tree and are not part of the wave branch.
  - Suggested fix: Orchestrator reads the packet from the job worktree, or un-ignore `.yardos/waves/*/review-packet.json`.
- [ ] **QL-w01-08** (`F-BE-01`, `persistence`): `PgUserRepository.getProfileView` computes `has_active_story` with the database `now()` instead of the injected `Clock`, so fake-clock tests cannot move story expiry; correct in production.
  - Suggested fix: Pass `clock.now()` as a query parameter when w04 (stories) touches this query.
- [ ] **QL-w01-09** (`F-BE-01`, `backend`): Replacing or removing an avatar leaves the previous `attached` media row and file in storage forever (known spec question `Q-06`); `MediaCleanupJob` only purges `uploaded` assets.
  - Suggested fix: Resolve `Q-06` (e.g. mark the old avatar `orphaned` for the cleanup job).
- [ ] **QL-w01-10** (`F-DB-04`, `infra`): The sandbox has no Docker or system Postgres; integration tests ran on `embedded-postgres` 16.9 installed under `$HOME` (`/tmp` is noexec). PGlite cannot run the advisory-lock test (QL-w00-26). All 117 integration tests pass on PostgreSQL 16.9; CI on `postgres:16-alpine` stays authoritative.
  - Suggested fix: Confirm the CI integration job is green on the wave branch.
- [ ] **QL-w01-11** (`F-FE-02`, `frontend`): There is no Playwright E2E suite yet (`apps/web/e2e` is absent; scheduled for w07), so login/signup/logout/edit-profile flows are covered only by component tests with a mocked API.
  - Suggested fix: Add the w01 flows to the w07 E2E plan.
- [x] **QL-w01-12** (`F-ECOMM-02`, `backend`): W01-02 skipped the two `PATCH /me` avatar integration tests while the media repository was a stub; with W01-03 merged they now run and pass.
- [x] **QL-w01-13** (`F-ECOMM-04`, `backend`): The acceptance criteria "PNG renamed `.mp4` is accepted as `image/png`" and INV-09 "password hash and raw token never appear in responses" had no explicit integration test; W01-06 added both.
- [ ] **QL-w01-19**: No Docker in the sandbox: the slot-1 compose stack was rendered, not started, and the browser flow was not clicked through (a live API smoke run was used instead).
- [ ] **QL-w01-20**: .env.wave lacks POSTGRES_PASSWORD; it must be exported before compose up.
- [ ] **QL-w01-21**: .yardos/ is gitignored, so review-packet.json and the compose bundle are not on the wave branch.
- [ ] **QL-w01-22**: getProfileView computes has_active_story with DB now() instead of the injected Clock.
- [ ] **QL-w01-23**: Replaced or removed avatars stay in storage forever (Q-06); the cleanup job only purges uploaded assets.
- [ ] **QL-w01-24**: Integration tests ran on embedded-postgres 16.9 because the sandbox has no Docker or system Postgres; CI on postgres:16-alpine is authoritative.
- [ ] **QL-w01-25**: No Playwright E2E suite yet (w07); web flows are covered only by component tests.
- [x] **QL-w01-26**: The skipped PATCH /me avatar integration tests from W01-02 now run and pass.
- [x] **QL-w01-27**: Tests for the PNG-renamed-.mp4 and INV-09 acceptance criteria were missing; W01-06 added them.

## Open Questions
- [ ] **QL-w01-14** (`F-BE-02`, `backend`): Should `MediaAsset.create` re-check size and dimension limits itself (it currently does, duplicating the streaming checks in `MediaService.upload`), or should only the upload path enforce them?
  - Suggested fix: Owner decides; keep the duplicate check until then (it is cheap and guards non-HTTP callers).
- [ ] **QL-w01-28**: Should MediaAsset.create re-check size and dimension limits itself, or only the upload path?
