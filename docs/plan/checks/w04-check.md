# Wave w04 — 24-Hour Stories: Owner Check Guide

Branch `wave/w04-stories` · compose project `yd-insta-w04` · slot 4 · web `http://localhost:21080` · api `http://localhost:21081`
(proxy URLs: `http://w04--insta.apps.localhost:9080`, `http://api--w04--insta.apps.localhost:9080`).

## Executive Summary

W04 adds photo and video stories that are visible for 24 hours. On the API, a signed-in user turns an uploaded
`story`-purpose media item into a story (`expires_at = created_at + 24h` from the injected `Clock`). Only the author can
delete it; the story, its media row and its views are removed in one transaction, then the file. Each user gets a story
tray of followees ∪ self with at least one active story, ordered self first, then unseen, then most recent. Other
endpoints list a user's active stories oldest-first, record idempotent "seen" marks (none for the author's own views),
and return an author-only viewer list (`viewed_at DESC`, keyset paginated). `view_count` is only set for the author.
Expired stories return `404` on every endpoint before cleanup runs (`INV-06`). `StoryCleanupJob` runs every 10 min under
`pg_try_advisory_lock(hashtext('story-cleanup'))` and deletes expired stories in batches of 500 with their media rows
and files. On the web, `StoryTray` (exported for w05's `HomePage`), the full-screen `StoryViewerPage`, `CreateStoryPage`
and the `state/stories*` hooks are in place. The viewer has segmented progress (images 5 s, videos their own length),
tap zones, `←/→`, `Esc`, hold/space pause, auto-advance through the tray, seen marks with optimistic tray updates, and a
"Seen by N" sheet for the author.

**Round 1 (W04-VAL-2, after W04-SYNC-1 merged the refreshed `main` `1c2510e` with w02 landed).** The branch was checked
again at `f32f22e`. The wave diff against `main` is 36 files, all inside the w04 `owned_paths`. The w02 merge did not
break anything in w04. Posts and stories both use `MediaAsset.assertAttachable`, and each rejects the other's media
purpose, which is tested on both sides. The `/create` → `/create/story` link and the `/create/story` and
`/stories/:username` routes are still in place. No code defects were found, so no code changed in this round.
The ledger had 14 entries written twice (QL-w04-15..28). They are now closed as duplicates of QL-w04-01..14. One new
tooling issue was recorded as QL-w04-33.

| Check (round 1, `f32f22e`) | Result |
|---|---|
| Wave audit (`validate-wave.mjs --require-guide`) | `ok`, no errors or warnings |
| Spec validator (`validate-specs.mjs`) | `"valid": true` |
| `npm run typecheck` / eslint / prettier | pass |
| Unit tests (`npm test`) | contracts 47, api 442, web 449 (938), all pass |
| Integration tests (PostgreSQL 16.13, embedded) | 12 files, 188 / 188 pass (stories 20) |
| E2E | none yet (Playwright scheduled for w07) |
| Compose preview slot 4 | not started; no Docker in the sandbox (QL-w04-07) |

W04-04 validation (2 iterations, before the sync) results:

| Check | Result |
|---|---|
| Wave audit (`validate-wave.mjs`) | `ok`, no errors or warnings |
| Spec validator (`validate-specs.mjs`) | `"valid": true` |
| `npm run typecheck` / eslint / prettier | pass |
| Unit tests (`npm test`) | contracts 47, api 326, web 377, all pass |
| Integration tests (`npm run test:integration`, PostgreSQL 16.13) | 137 / 137 pass (stories 20, 1 added in W04-04) |
| E2E | none yet (Playwright scheduled for w07) |
| `vite build` | pass |
| Live API smoke on port 21081 (real server, migrations on start) | create → tray → seen → viewer list → 403s → delete, all as specified |
| Compose preview slot 4 | rendered only; no Docker in the sandbox (QL-w04-07) |

Iteration 1 compared the code with `external-communication/05`, `backend/02`/`03`, `persistence/01`, `frontend/01` and
the wave plan. Routes, DTOs, the `StoryRepository` port, mappers (DTO ↔ View/Entity ↔ Row) and layering
(`api → domain ← data`) all match the spec. No handler returns rows, no file is over 600 lines, and there are no stray
root files. One test gap was fixed: `DELETE /stories/{id}` had no `401`/`400`/unknown-id `404` test, so one was added.
The only behaviour defect found (the missing `logger` wiring in `main.ts`, QL-w04-04) is outside the w04 `owned_paths`
and is recorded. Iteration 2 wrote this guide and the ledger below.

## Delivered Features

- `F-BE-06` — `StoryService` (createStory, deleteStory, getTray, getUserStories, markSeen, listViewers)
- `F-BE-09` — `StoryCleanupJob` (advisory lock, batches of 500, story + media row + views + file)
- `F-ECOMM-08` — `POST /stories`, `DELETE /stories/{id}`, `GET /stories/tray`, `GET /users/{username}/stories`, `POST /stories/{id}/seen`, `GET /stories/{id}/viewers`
- `F-FE-09` — `StoryTray`, `StoryViewerPage` (`/stories/:username`), `CreateStoryPage` (`/create/story`), `StoryProgress`, `StoryViewers`, `state/stories*`
- `F-CORE-03` — ENT-Story, ENT-StoryView entities with DTO ↔ Business ↔ Row mappers
- `F-DB-04` — story row mappers and integration tests against real PostgreSQL

## Step-by-Step Verification Guide

### Step 1 — Static gates and unit tests (`F-CORE-03`, `F-FE-09`)

- **Where:** repository root on `wave/w04-stories`.
- **How:** `npm ci && npm run typecheck && npm run lint && npm run format:check && npm test`
- **Expected:** every command exits 0; vitest reports contracts 47, api 442 and web 449 tests passed (the web count includes progress timing, keyboard navigation and pause tests with fake timers).

### Step 2 — Integration tests on PostgreSQL 16 (`F-DB-04`, `F-ECOMM-08`, `F-BE-06`, `F-BE-09`)

- **Where:** repository root, with a disposable PostgreSQL 16 database (it is wiped).
- **How:** `docker run -d --rm --name w04-pg -e POSTGRES_PASSWORD=pg -p 55432:5432 postgres:16-alpine` then
  `TEST_DATABASE_URL=postgres://postgres:pg@localhost:55432/postgres npm run test:integration`
- **Expected:** `Test Files 12 passed`, `Tests 188 passed`. `test/integration/stories/stories.test.ts` (20 tests) covers happy path, `400`, `401`, `403`, `404` and `422 MEDIA_INVALID` per endpoint. It also covers expiry at exactly `created_at + 24h` on every endpoint, tray ordering, idempotent seen, keyset viewer pagination, and the cleanup job (including the skip while another session holds the lock).

### Step 3 — Wave audit and spec validation

- **Where:** repository root.
- **How:** `node .yardos/skills/wave-validate/scripts/validate-wave.mjs --root . --wave w04 --require-guide --json` and
  `node .agents/skills/spec-architect/scripts/validate-specs.mjs --root . --json`
- **Expected:** `"ok": true` with empty `errors`, and `gaps_file_path` is `docs/questions-and-limitations/w04-gaps.md`; the spec validator reports `"valid": true`.

### Step 4 — Render the slot-4 compose bundle (`F-INFRA-04`)

- **Where:** repository root.
- **How:** `node .yardos/skills/wave-compose-deploy/scripts/compose-wave.mjs --root . --project insta --wave w04 --slot-index 4 --render-only --json`
- **Expected:** `"compose_project": "yd-insta-w04"`, `"port_base": 21080`, web → `21080`, api → `21081`; `.yardos/waves/w04/compose.wave.yml` publishes no host port for `db`.

### Step 5 — Start the w04 stack

- **Where:** a Docker host, at the repository root.
- **How:** create `.yardos/waves/w04/compose.local.yml` with
  `services: { api: { environment: { PUBLIC_URL: "http://localhost:21080", PUBLIC_API_URL: "http://localhost:21081", CORS_ORIGIN: "http://localhost:21080" } }, web: { environment: { PUBLIC_URL: "http://localhost:21080", PUBLIC_API_URL: "http://localhost:21081" } } }`
  then run
  `export POSTGRES_PASSWORD=$(openssl rand -hex 16) && docker compose --project-directory . -p yd-insta-w04 -f .yardos/waves/w04/compose.base.yml -f .yardos/waves/w04/compose.wave.yml -f .yardos/waves/w04/compose.local.yml --env-file .yardos/waves/w04/.env.wave up -d --build --wait`
  (skip the override when testing through the Hoster proxy).
- **Expected:** exits 0 with `db`, `api`, `web` all `Healthy`; `curl http://localhost:21081/api/v1/health` → `200 {"status":"ok","db":"ok",…}`.

### Step 6 — Two accounts; Bob follows Alice (`F-ECOMM-02` prerequisite)

- **Where:** `POST http://localhost:21081/api/v1/auth/signup`, then `docker compose -p yd-insta-w04 exec db psql -U insta insta`.
- **How:** sign up `alice` and `bob` (`-d '{"username":"alice","email":"alice@example.test","password":"password123"}'`, same for `bob`) and save each `access_token` as `$AT` / `$BT`. The follow API is w03's and is not on this branch (QL-w04-10), so in psql run
  `INSERT INTO follows (follower_id, followee_id) SELECT b.id, a.id FROM users a, users b WHERE a.username='alice' AND b.username='bob';`
- **Expected:** both signups return `201`; the insert reports `INSERT 0 1`.

### Step 7 — Create a story (`F-ECOMM-08`, `F-BE-06`)

- **Where:** `POST http://localhost:21081/api/v1/media`, then `POST http://localhost:21081/api/v1/stories`.
- **How:** `curl -s -H "authorization: Bearer $AT" -F purpose=story -F file=@photo.png localhost:21081/api/v1/media` → `med_…`; then
  `curl -s -H "authorization: Bearer $AT" -H 'content-type: application/json' -d '{"media_id":"med_…"}' localhost:21081/api/v1/stories`.
  Repeat the second call with the same `media_id`, and once with a media uploaded with `purpose=post`.
- **Expected:** first call `201` with `id: "sty_…"`, `expires_at` exactly 24 h after `created_at`, `viewer_has_seen: false`, `view_count: 0`. In psql the media row has `status = 'attached'`. Both repeats return `422` `MEDIA_INVALID`.

### Step 8 — Bob sees Alice in the tray; per-user stories (`F-ECOMM-08`)

- **Where:** `GET /api/v1/stories/tray` and `GET /api/v1/users/alice/stories` on port 21081.
- **How:** call both with `-H "authorization: Bearer $BT"`, then call the user-stories URL again without a token, and the tray without a token.
- **Expected:** the tray is `200` with one item, `user.username: "alice"`, `has_unseen: true`, `story_count: 1`. The user-stories call is `200` with one story, `viewer_has_seen: false`, `view_count: null`, and the same result anonymously. The anonymous tray call returns `401`.

### Step 9 — Mark seen: idempotent, author is a no-op (`F-ECOMM-08`, `F-BE-06`)

- **Where:** `POST /api/v1/stories/{sty_…}/seen` on port 21081.
- **How:** call it twice with `$BT` and once with `$AT`; then call `GET /api/v1/stories/tray` with `$BT`.
- **Expected:** all three calls return `204`. psql `SELECT count(*) FROM story_views;` → `1` (Bob's, first `viewed_at` kept; no row for Alice). Bob's tray item now has `has_unseen: false`.

### Step 10 — Author-only viewer list (`F-ECOMM-08`)

- **Where:** `GET /api/v1/stories/{sty_…}/viewers` and `GET /api/v1/users/alice/stories` on port 21081.
- **How:** call the viewer list with `$AT`, then with `$BT`; call user stories with `$AT`.
- **Expected:** with `$AT`: `200`, `items[0].user.username: "bob"`, `next_cursor: null`. With `$BT`: `403` `FORBIDDEN`. Alice's own story shows `view_count: 1`.

### Step 11 — Delete: author only, file removed (`F-ECOMM-08`, `F-BE-06`, `INV-10`)

- **Where:** `DELETE /api/v1/stories/{sty_…}` on port 21081.
- **How:** call it with `$BT`, then with `$AT`, then call `POST /api/v1/stories/{sty_…}/seen` with `$BT`.
- **Expected:** Bob gets `403` `FORBIDDEN` and the story stays. Alice gets `204`; in psql the `stories`, `story_views` and `media_assets` rows are gone. `GET /media/<storage_key>` returns `404`, and the file is gone from the `media` volume. The final seen call returns `404` `NOT_FOUND`.

### Step 12 — Web: create and watch a story in a browser (`F-FE-09`)

- **Where:** `http://localhost:21080/create/story` (signed in as Alice), then `http://localhost:21080/stories/alice` (signed in as Bob in a second browser profile).
- **How:** as Alice, pick an image, check the preview and click Share. As Bob, open `/stories/alice`, watch the progress bar, then press `Space`, `→`, `←`, hold a tap zone, and press `Esc`. As Alice, open `/stories/alice` and click "Seen by 1".
- **Expected:** sharing navigates Alice to `/` (home). Bob's viewer fills one segment over about 5 s, `Space` and hold pause it, the arrows move between stories, and `Esc` closes the viewer. Bob's view is recorded (one `story_views` row). Alice sees no seen-mark request for her own story, and the "Seen by 1" sheet lists `bob`. The tray itself is only placed on `HomePage` in w05 (QL-w04-11).

### Step 13 — Expiry and `StoryCleanupJob` (`F-BE-09`, `INV-06`)

- **Where:** psql in `db`, the API on port 21081, and `docker compose -p yd-insta-w04 logs api`.
- **How:** create a new story (step 7), then in psql run
  `UPDATE stories SET created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour';`
  Call `GET /api/v1/users/alice/stories` and `GET /api/v1/stories/tray` (`$AT`). Wait up to 10 min for the job tick, or run `docker compose -p yd-insta-w04 restart api`.
- **Expected:** immediately, user stories returns `stories: []` and the tray returns `items: []`, while the row still exists. After the next tick the api log shows `{ job: "story-cleanup", deleted: 1, … }`, and the `stories` row, its `media_assets` row and its file are gone.

### Step 14 — Tear down

- **Where:** repository root.
- **How:** `docker compose -p yd-insta-w04 down -v` (or `compose-wave.mjs --root . --project insta --wave w04 --down --json`).
- **Expected:** the containers, network and `db-data`/`media` volumes of `yd-insta-w04` are removed; other wave stacks are untouched.

## Open Questions & Limitations

- [ ] **QL-w04-01** (`F-BE-06`, `backend`): `StoryServiceDeps` still adds `storage: MediaStorage` (file removal after `deleteStory`), `users: UserRepository` (resolve `username` in `getUserStories`) and an optional `logger`, none of which are in the backend/02 `StoryService` port list (carried over from QL-w00-03, still unresolved in the spec).
- [ ] **QL-w04-02** (`F-FE-09`, `frontend`): The author-only viewer list uses the query key `["storyViewers", storyId]` (staleTime 0), which is not in the frontend/02 query-key table, so W04-03 defined it in `apps/web/src/state/stories.ts` instead of `query-keys.ts`.
- [ ] **QL-w04-03** (`F-CORE-01`, `specs`): The W04-04 task lists spec refs `F-BE-06` and `F-ECOMM-08` only, while the wave plan (docs/plan/waves/W04-stories.md) also covers and delivered `F-BE-09` (story cleanup), `F-FE-09`, `F-CORE-03` and `F-DB-04`.
- [ ] **QL-w04-04** (`F-BE-06`, `backend`): `apps/api/src/main.ts` builds `StoryService` without its `logger`, so when `DELETE /api/v1/stories/{id}` commits but the file removal fails, the failure is silently swallowed instead of logged as backend/02 requires. `main.ts` is outside the w04 `owned_paths`, so it was not fixed here.
- [ ] **QL-w04-05** (`F-BE-09`, `backend`): When a file removal fails after a commit (in `deleteStory` or in `StoryCleanupJob`), the story and media rows are already deleted, so the file is orphaned permanently: "retried on the next tick" (backend/03) cannot happen because nothing references the key any more.
- [ ] **QL-w04-06** (`F-BE-01`, `persistence`): QL-w01-08 is still open: `PgUserRepository.getProfileView` computes `has_active_story` with the database `now()` instead of the injected `Clock`. `users.pg-repository.ts` is outside the w04 `owned_paths`; the profile ring can disagree with fake-clock tests but is correct in production.
- [ ] **QL-w04-07** (`F-INFRA-04`, `infra`): Docker is not available in the validation sandbox, so the slot-4 compose stack (`yd-insta-w04`, web 21080, api 21081) was only rendered; `compose-wave.mjs --up` fails because there is no `docker` binary. Substitute evidence: a live API smoke run of the real server on port 21081 against PostgreSQL 16.13 (create story → second account sees it in the tray → seen → author's viewer list → 403s → delete removes row and file). The browser UI was not clicked through.
- [ ] **QL-w04-08** (`F-INFRA-05`, `infra`): As in QL-w01-06, the rendered `.yardos/waves/w04/.env.wave` has no `POSTGRES_PASSWORD`, so `compose-wave.mjs --up` fails unless it is exported in the calling shell.
- [ ] **QL-w04-09** (`F-INFRA-04`, `infra`): `.yardos/` is gitignored, so `.yardos/waves/w04/review-packet.json` and the compose bundle exist only in the validator's working tree and are not part of the wave branch (same as QL-w01-07).
- [ ] **QL-w04-10** (`F-ECOMM-08`, `external-communication`): The follow endpoints belong to w03 and are not on `wave/w04-stories` (`POST /api/v1/users/{username}/follow` → 404), so another user's stories can only reach a tray in the w04 preview after inserting a `follows` row with SQL. This resolves when w03 lands and is synced into w04.
- [ ] **QL-w04-11** (`F-FE-09`, `frontend`): `StoryTray` is exported but not placed on `HomePage` (w05 scope), so in the w04 preview the tray is not visible in the UI. The viewer is reached directly at `/stories/:username` and story creation at `/create/story` (also linked from `/create`).
- [ ] **QL-w04-12** (`F-DB-04`, `infra`): There is no Docker or system Postgres in the sandbox; integration tests ran on embedded PostgreSQL 16.13. There is no Playwright E2E suite yet (scheduled for w07), so the story viewer, tray and create flows are covered only by component tests with a mocked API and fake timers.
- [ ] **QL-w04-13** (`F-CORE-03`, `infra`): `tsc -p apps/api/test/tsconfig.json` reports one error in a w01 file (`apps/api/test/integration/identity/identity.test.ts:122`, `password_hash` on a possibly-undefined row). Vitest is not affected and `npm run typecheck` does not include the test tsconfig, so this does not block CI; no w04 test file has type errors.
- [ ] **QL-w04-14** (`F-CORE-01`, `specs`): A 2026-11-18 planning note says w04 was cancelled after w01 failed, but w01 landed in `f94739b` and W04-01..W04-03 are merged into `wave/w04-stories`. Is w04 active and cleared to land?
- [ ] **QL-w04-29** (`F-DB-04`, `infra`): In `wave-sync.mjs`, `MIGRATION_FILE_RE` only matches `migrations/`, `db/migrations/` and `prisma/migrations/`, so it never detects collisions in this repo's `apps/api/migrations/`. W04-SYNC-1 had no collision (neither side added a migration since merge-base `af94d81`), which was checked by hand.
- [ ] **QL-w04-30** (`F-INFRA-04`, `infra`): `wave-sync.mjs` has no `--help`, ignores unknown flags and defaults to `--wave w01`. A bare `--help` ran a real sync and created a local `wave/w01-backend-and-persistence` ref; it was not pushed and was deleted at once.
- [ ] **QL-w04-31** (`F-INFRA-04`, `infra`): `--sync-issues` only looks at local `refs/heads/issue/WNN-*`, so issue branches that exist only on the remote are skipped without a message. For w04, `issue/W04-02` and `issue/W04-03` are already fully merged into the wave (0 commits ahead), so nothing needed to be propagated.
- [ ] **QL-w04-32** (`F-INFRA-04`, `infra`): In the sandbox, running `npm ci` as the `--test-cmd` gate fails in the `/tmp` sync worktree (argon2 install script exits 126, so `/tmp` is likely noexec). The gate passed after symlinking `node_modules` from the job worktree into the sync worktree. Also, `git push` has no credentials, so the synced `wave/w04-stories` (`170de32`) exists only locally and on the job branch. Update (W04-VAL-2 round 1): `origin/wave/w04-stories` now points at `f32f22e`, which contains `170de32`, so the push part is resolved; the `/tmp` noexec part stays open.
- [ ] **QL-w04-33** (`F-INFRA-04`, `infra`): `validate-wave.mjs` reports `files_changed_count` as the number of all source files (476) when the worktree is clean, because it counts `git status --porcelain` lines and falls back to every file. The real wave diff against the refreshed `main` (`1c2510e`) is 36 files, all inside the w04 `owned_paths`.
