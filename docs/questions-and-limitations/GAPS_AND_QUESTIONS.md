# Consolidated Gaps, Issues & Open Questions

> Automatically compiled from per-wave ledgers (`docs/questions-and-limitations/wNN-gaps.md`) as each wave lands on `main`.
> **Owner Action Required:** Please review the items below, answer any open questions, and run a remediation pass (Dashboard **Review & Fix Open Items**, `cortexctl spec-plans fix-gaps <spn_id>`, or direct fix) to resolve them.

## Summary
- **Waves recorded:** 2 (`docs/questions-and-limitations/w00-gaps.md`, `docs/questions-and-limitations/w01-gaps.md`)
- **Open items:** 46 of 54 total (Gaps: 18, Issues: 25, Open Questions: 3)

## Wave w00
_Source: `docs/questions-and-limitations/w00-gaps.md`_
- [ ] **[GAP] QL-w00-01** (`F-FE-12`, `frontend`): frontend/02 names the SSE client module `state/live.ts`, but the wave plan (W00-03) and the code use `apps/web/src/state/sse.ts`.
  - Suggested fix: Rename the spec section to `state/sse.ts` (code and wave plan agree); no code change.
- [ ] **[GAP] QL-w00-02** (`F-FE-01`, `frontend`): The frontend spec does not say which `apps/web/src/api/*.ts` module hosts cross-resource calls; W00-03 put feed/explore/like in `api/posts.ts`, follow/unfollow in `api/users.ts` and hashtag posts in `api/search.ts`.
  - Suggested fix: Record this placement in frontend/01 or 02 so w02–w05 keep it.
- [ ] **[GAP] QL-w00-03** (`F-CORE-03`, `backend`): `StoryServiceDeps` adds `storage: MediaStorage` (delete the file after `deleteStory` commits) and `users: UserRepository` (resolve `username` in `getUserStories`); neither is in the backend/02 port list.
  - Suggested fix: Add both ports to backend/02 `StoryService` before w04 relies on them.
- [ ] **[GAP] QL-w00-04** (`F-ICOMM-01`, `internal-communication`): Search `limit` defaults to `LIMITS.searchLimitDefault` = 10 in `packages/contracts/src/dto/search.ts`; the spec states a max but no default.
  - Suggested fix: Confirm 10 and add it to external-communication/06 and internal-communication/01.
- [ ] **[GAP] QL-w00-05** (`F-INFRA-04`, `infra`): infra/01 defines the wave port block as `18000 + NN*10` (10 ports) rendered to `.env.wave-<wNN>`, while the wave-compose-deploy skill and the wave plan use `21000 + slot*20` (20 ports) in `.yardos/waves/<wNN>/.env.wave`.
  - Suggested fix: Update infra/01 + infra/02 to the skill's scheme (21000 + slot*20, `.yardos/waves/<wNN>/`); keep 18000/18001 as plain-compose defaults.
- [ ] **[GAP] QL-w00-14**: frontend/02 names the SSE client state/live.ts; the code and wave plan use apps/web/src/state/sse.ts.
- [ ] **[GAP] QL-w00-15**: The spec does not say which web api/*.ts module hosts feed/explore/like, follow and hashtag-post calls (placed in posts.ts, users.ts and search.ts).
- [ ] **[GAP] QL-w00-16**: StoryServiceDeps adds storage: MediaStorage and users: UserRepository, which are not in the backend/02 port list.
- [ ] **[GAP] QL-w00-17**: Search limit default 10 (LIMITS.searchLimitDefault) is not in the spec.
- [ ] **[GAP] QL-w00-18**: infra/01 wave port block (18000 + NN*10, .env.wave-<wNN>) differs from the deploy skill and wave plan (21000 + slot*20, .yardos/waves/<wNN>/.env.wave).
- [ ] **[ISSUE] QL-w00-06** (`F-INFRA-01`, `infra`): Docker is not available in the validation sandbox, so image builds, the API image size cap (< 250 MB), the nginx config, `docker compose up --wait` health and the two-stack side-by-side run (F-INFRA-03/04) were NOT executed; only the compose render and a static isolation diff (slot 0 vs slot 1) were checked.
  - Suggested fix: Owner runs check-guide steps 6–12 on a Docker host before landing.
- [ ] **[ISSUE] QL-w00-07** (`F-INFRA-05`, `infra`): The wave-compose-deploy bundle `.env.wave` has no `POSTGRES_PASSWORD`, but compose requires `${POSTGRES_PASSWORD:?}`, so `compose-wave.mjs --up` fails unless the variable is exported in the calling shell (infra/02 expects a random per-wave value).
  - Suggested fix: Export `POSTGRES_PASSWORD=$(openssl rand -hex 16)` before `--up` (see check guide step 6); longer-term the skill should generate it.
- [ ] **[ISSUE] QL-w00-08** (`F-INFRA-04`, `infra`): The wave overlay hard-codes `PUBLIC_URL`/`PUBLIC_API_URL`/`CORS_ORIGIN` to `*.apps.localhost:9080` proxy URLs, which only work behind the Hoster proxy; browsing `http://localhost:21000` directly gives an SPA whose `apiUrl` points at the proxy, and `compose-wave.mjs --up` does not pass `--wait`.
  - Suggested fix: For direct-port checks use the `compose.local.yml` override from check-guide step 6.
- [x] **[ISSUE] QL-w00-09** (`F-INFRA-04`, `infra`): wave-compose-deploy assigns port offsets in compose declaration order; with `api` declared before `web` it mapped api→21000 and web→21001 and pointed `PUBLIC_URL`/`CORS_ORIGIN` at the API. Fixed in W00-05 by declaring `web` before `api` in `docker-compose.yml` (web 21000, api 21001).
- [x] **[ISSUE] QL-w00-10** (`F-CORE-02`, `specs`): `import/no-restricted-paths` zones resolved against `process.cwd()`, so layer rules were silently off when ESLint ran from a workspace directory (IDE, `apps/api`). Fixed in W00-05 with `basePath: import.meta.dirname` in `eslint.config.js` plus `apps/api/test/unit/shared/layer-boundaries.test.ts` (6 lint-fixture tests).
- [ ] **[ISSUE] QL-w00-11** (`F-DB-01`, `persistence`): Integration tests (41/41) were run against PGlite 0.3 (WASM Postgres via `@electric-sql/pglite-socket`, with `pg_trgm`) and not PostgreSQL 16; the CI `compose-e2e`/integration job on `postgres:16-alpine` is the authoritative run.
  - Suggested fix: Run check-guide step 4 against `postgres:16-alpine`.
- [ ] **[ISSUE] QL-w00-12** (`F-INFRA-06`, `infra`): No E2E specs exist yet (Playwright location `apps/web/e2e/` is decision P-4, delivered in w07); the CI e2e step tolerates "no specs".
- [ ] **[ISSUE] QL-w00-19**: No Docker in the sandbox: image builds, api image < 250 MB, nginx, compose up --wait and the two-stack side-by-side run were not executed (owner runs guide steps 6–13).
- [ ] **[ISSUE] QL-w00-20**: .env.wave has no POSTGRES_PASSWORD, so compose-wave --up fails unless it is exported.
- [ ] **[ISSUE] QL-w00-21**: The wave overlay hard-codes proxy URLs (*.apps.localhost:9080) and --up does not --wait; direct-port testing needs the compose.local.yml override.
- [x] **[ISSUE] QL-w00-22**: compose-wave mapped api→21000 and web→21001 because of declaration order; fixed by declaring web before api.
- [x] **[ISSUE] QL-w00-23**: ESLint import/no-restricted-paths depended on cwd; fixed with basePath plus the layer-boundaries regression test.
- [ ] **[ISSUE] QL-w00-24**: Integration tests ran against PGlite, not PostgreSQL 16; the CI run on postgres:16-alpine is authoritative.
- [ ] **[ISSUE] QL-w00-25**: No E2E specs until w07 (P-4: apps/web/e2e/).
- [ ] **[ISSUE] QL-w00-26** (`F-INFRA-07`, `persistence`): During W00-LAND-R1 the integration suite ran 40/41 against PGlite (0.3.15 and 0.5.16 via `@electric-sql/pglite-socket`), not the 41/41 that the check guide reports. `startup.test.ts` "runJobOnce holds a real advisory lock…" fails because the PGlite socket server accepts only one connection at a time: the job holds a pooled client, and the test's second `pool.query` times out, so the job returns `failed`. This is a test-environment limit, not a code defect.
  - Suggested fix: Treat the CI integration job on `postgres:16-alpine` as the gate (see QL-w00-11/24); optionally skip this one test when the test DB is PGlite.
- [ ] **[QUESTION] QL-w00-13** (`F-INFRA-04`, `infra`): Which wave port scheme is canonical: infra/01 (`18000 + NN*10`) or the deploy skill (`21000 + slot*20`)?
  - Suggested fix: Proposed: the skill's scheme (see the related gap); owner to confirm.

## Wave w01
_Source: `docs/questions-and-limitations/w01-gaps.md`_
- [ ] **[GAP] QL-w01-01** (`F-ECOMM-04`, `external-communication`): `POST /api/v1/media` only reads text parts (`purpose`, `width`, `height`, `duration_ms`) that come before the `file` part; parts after the file are ignored, so a `duration_ms` sent after a video file returns `400 VALIDATION_FAILED`. external-communication/03 does not state this ordering rule (the web client `buildUploadForm` already appends fields first).
  - Suggested fix: Add "text parts MUST precede `file`; later parts are ignored" to the `UploadMediaRequest` table in external-communication/03.
- [ ] **[GAP] QL-w01-02** (`F-ECOMM-02`, `external-communication`): `PATCH /api/v1/me` re-sending the user's current `avatar_media_id` is a `200` no-op instead of `422 MEDIA_INVALID` (the asset is already `attached`); external-communication/02 and backend/02 are silent on this case.
  - Suggested fix: Record the no-op rule in the external-communication/02 Behaviour list.
- [ ] **[GAP] QL-w01-03** (`F-CORE-01`, `specs`): There is no `owned_paths` prefix for domain-entity unit tests, so `User`/`Session`/`MediaAsset`/`Notification` entity tests live in `apps/api/test/unit/mappers/*.entity.test.ts` (W01-01's first run failed with `owned_paths_violation` for this reason).
  - Suggested fix: Add `apps/api/test/unit/domain/<module>/` to the ownership prefixes in specs/01-project-structure.md and move the four files in a later wave.
- [ ] **[GAP] QL-w01-04** (`F-CORE-01`, `specs`): The W01-06 task lists spec refs `F-BE-01`, `F-BE-02`, `F-ECOMM-02`, `F-ECOMM-04`, while the wave plan (docs/plan/waves/W01-identity-media.md) also covers `F-ECOMM-03`, `F-BE-08` (write side), `F-BE-09`, `F-FE-02`, `F-FE-07`, `F-CORE-03` and `F-DB-04`, all of which were delivered.
  - Suggested fix: Align the w01 task `spec_refs` in WAVE_MANIFEST.json with the wave plan.
- [ ] **[GAP] QL-w01-15**: POST /api/v1/media only reads text parts that come before the file part; external-communication/03 does not document this ordering rule.
- [ ] **[GAP] QL-w01-16**: PATCH /me re-sending the current avatar_media_id is a 200 no-op rather than 422 MEDIA_INVALID; the spec is silent.
- [ ] **[GAP] QL-w01-17**: No owned_paths prefix for domain-entity unit tests; they live in apps/api/test/unit/mappers/*.entity.test.ts.
- [ ] **[GAP] QL-w01-18**: The W01-06 task spec_refs list 4 features; the wave plan covers and delivered 11.
- [ ] **[ISSUE] QL-w01-05** (`F-INFRA-04`, `infra`): Docker is not available in the validation sandbox, so the slot-1 compose stack (`yd-insta-w01`, web 21020, api 21021) was only rendered, not started, and the browser flow (signup → upload avatar → edit profile) was not clicked through. Substitute evidence: a live API smoke run on port 21021 against PostgreSQL 16.9 (signup, 409, identical 401s, avatar upload renamed `.mp4`, 415, PATCH /me, media serving headers, traversal 404, logout + token reuse 401, no secrets in logs) plus web component tests.
  - Suggested fix: Owner runs check-guide steps 5–13 on a Docker host before landing.
- [ ] **[ISSUE] QL-w01-06** (`F-INFRA-05`, `infra`): As in QL-w00-07, the rendered `.yardos/waves/w01/.env.wave` has no `POSTGRES_PASSWORD`, so `compose-wave.mjs --up` fails unless it is exported in the calling shell.
  - Suggested fix: `export POSTGRES_PASSWORD=$(openssl rand -hex 16)` before `up` (check-guide step 5); the deploy skill should generate it.
- [ ] **[ISSUE] QL-w01-07** (`F-INFRA-04`, `infra`): `.yardos/` is gitignored, so `.yardos/waves/w01/review-packet.json` and the compose bundle exist only in the validator's working tree and are not part of the wave branch.
  - Suggested fix: Orchestrator reads the packet from the job worktree, or un-ignore `.yardos/waves/*/review-packet.json`.
- [ ] **[ISSUE] QL-w01-08** (`F-BE-01`, `persistence`): `PgUserRepository.getProfileView` computes `has_active_story` with the database `now()` instead of the injected `Clock`, so fake-clock tests cannot move story expiry; correct in production.
  - Suggested fix: Pass `clock.now()` as a query parameter when w04 (stories) touches this query.
- [ ] **[ISSUE] QL-w01-09** (`F-BE-01`, `backend`): Replacing or removing an avatar leaves the previous `attached` media row and file in storage forever (known spec question `Q-06`); `MediaCleanupJob` only purges `uploaded` assets.
  - Suggested fix: Resolve `Q-06` (e.g. mark the old avatar `orphaned` for the cleanup job).
- [ ] **[ISSUE] QL-w01-10** (`F-DB-04`, `infra`): The sandbox has no Docker or system Postgres; integration tests ran on `embedded-postgres` 16.9 installed under `$HOME` (`/tmp` is noexec). PGlite cannot run the advisory-lock test (QL-w00-26). All 117 integration tests pass on PostgreSQL 16.9; CI on `postgres:16-alpine` stays authoritative.
  - Suggested fix: Confirm the CI integration job is green on the wave branch.
- [ ] **[ISSUE] QL-w01-11** (`F-FE-02`, `frontend`): There is no Playwright E2E suite yet (`apps/web/e2e` is absent; scheduled for w07), so login/signup/logout/edit-profile flows are covered only by component tests with a mocked API.
  - Suggested fix: Add the w01 flows to the w07 E2E plan.
- [x] **[ISSUE] QL-w01-12** (`F-ECOMM-02`, `backend`): W01-02 skipped the two `PATCH /me` avatar integration tests while the media repository was a stub; with W01-03 merged they now run and pass.
- [x] **[ISSUE] QL-w01-13** (`F-ECOMM-04`, `backend`): The acceptance criteria "PNG renamed `.mp4` is accepted as `image/png`" and INV-09 "password hash and raw token never appear in responses" had no explicit integration test; W01-06 added both.
- [ ] **[ISSUE] QL-w01-19**: No Docker in the sandbox: the slot-1 compose stack was rendered, not started, and the browser flow was not clicked through (a live API smoke run was used instead).
- [ ] **[ISSUE] QL-w01-20**: .env.wave lacks POSTGRES_PASSWORD; it must be exported before compose up.
- [ ] **[ISSUE] QL-w01-21**: .yardos/ is gitignored, so review-packet.json and the compose bundle are not on the wave branch.
- [ ] **[ISSUE] QL-w01-22**: getProfileView computes has_active_story with DB now() instead of the injected Clock.
- [ ] **[ISSUE] QL-w01-23**: Replaced or removed avatars stay in storage forever (Q-06); the cleanup job only purges uploaded assets.
- [ ] **[ISSUE] QL-w01-24**: Integration tests ran on embedded-postgres 16.9 because the sandbox has no Docker or system Postgres; CI on postgres:16-alpine is authoritative.
- [ ] **[ISSUE] QL-w01-25**: No Playwright E2E suite yet (w07); web flows are covered only by component tests.
- [x] **[ISSUE] QL-w01-26**: The skipped PATCH /me avatar integration tests from W01-02 now run and pass.
- [x] **[ISSUE] QL-w01-27**: Tests for the PNG-renamed-.mp4 and INV-09 acceptance criteria were missing; W01-06 added them.
- [ ] **[QUESTION] QL-w01-14** (`F-BE-02`, `backend`): Should `MediaAsset.create` re-check size and dimension limits itself (it currently does, duplicating the streaming checks in `MediaService.upload`), or should only the upload path enforce them?
  - Suggested fix: Owner decides; keep the duplicate check until then (it is cheap and guards non-HTTP callers).
- [ ] **[QUESTION] QL-w01-28**: Should MediaAsset.create re-check size and dimension limits itself, or only the upload path?

## Final Review & Remediation Checklist
1. Review every `[ ]` open item above and decide the desired behavior for any `[QUESTION]` entries.
2. Trigger automated remediation via the YardOS Dashboard (**Review & Fix Open Items**), `cortexctl spec-plans fix-gaps <spn_id> --instructions "..."`, or fix directly on `main` and mark resolved items `[x]`.
