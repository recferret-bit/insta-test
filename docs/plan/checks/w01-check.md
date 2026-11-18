# Wave w01 — Identity, Sessions, Media Pipeline & Notification Write Side: Owner Check Guide

Branch `wave/w01-identity-media` · compose project `yd-insta-w01` · slot 1 · web `http://localhost:21020` · api `http://localhost:21021`
(proxy URLs: `http://w01--insta.apps.localhost:9080`, `http://api--w01--insta.apps.localhost:9080`).

## Executive Summary

W01 turns the w00 skeleton into real accounts and media. Users can sign up (auto-login), log in by username or email,
log out (current session only), read and edit their own profile including an avatar upload, and view any public profile.
Photos and videos are uploaded through a streaming pipeline: the type is sniffed from magic bytes, size limits are
enforced per kind, image dimensions are probed server-side, and files are stored as `<yyyy>/<mm>/<uuid>.<ext>` and served
immutably from `/media/*`. `MediaCleanupJob` purges unattached uploads after 24 h. The notification repository write side
(`insertIfAbsent` with like/follow dedupe, `deleteFor`) is ready for w02/w03 to call inside their transactions. On the web,
the login, signup and edit-profile pages, the auth/me state, and a reusable upload hook with progress and cancel are in place.

W01-06 validation (2 iterations) results:

| Check | Result |
|---|---|
| Wave audit (`validate-wave.mjs`) | `ok`, no errors or warnings |
| `npm run typecheck` / `npm run lint` / `npm run format:check` | pass |
| Unit tests (`npm test`) | contracts 47, api 268, web 325, all pass |
| Integration tests (`npm run test:integration`, PostgreSQL 16.9) | 117 / 117 pass (2 added in W01-06) |
| E2E | none yet (Playwright scheduled for w07) |
| `vite build` | pass |
| Live API smoke run on port 21021 | signup → avatar upload → PATCH /me → media served → logout → 401 all as expected |
| Compose preview slot 1 | rendered only; no Docker in the sandbox (QL-w01-05) |

Iteration 1 found no spec-parity, layering (`api → domain ← data`), row-leak, size-cap or stray-file defects. It added
the two missing acceptance tests (PNG renamed `.mp4`; INV-09 no password/hash/token leak). Iteration 2 recorded the
ledger below.

## Delivered Features

- `F-BE-01` — `IdentityService` (register, login with dummy argon2 verify, logout, authenticate, getMe, updateProfile, getProfile)
- `F-BE-02` — `MediaService.upload` (sniff, stream with limit, probe, insert, delete file on failure)
- `F-BE-08` — notification persistence write side (`insertIfAbsent`, `deleteFor`)
- `F-BE-09` — `MediaCleanupJob` (advisory lock, batches of 500, rows then files)
- `F-ECOMM-02` — `POST /auth/signup|login|logout`, `GET|PATCH /me`
- `F-ECOMM-03` — `GET /users/{username}`
- `F-ECOMM-04` — `POST /api/v1/media`, `GET /media/{storage_key}`
- `F-FE-02` — `/login`, `/signup`, logout, `state/auth`, `state/me`
- `F-FE-07` — `/settings/profile` (`EditProfilePage`, `AvatarUploader`, `UploadProgress`, `state/upload`)
- `F-CORE-03` — ENT-User, ENT-Session, ENT-Media, ENT-Notification entities with DTO ↔ Business ↔ Row mappers
- `F-DB-04` — integration tests against real PostgreSQL

## Step-by-Step Verification Guide

### Step 1 — Static gates and unit tests (`F-CORE-03`)

- **Where:** repository root on `wave/w01-identity-media`.
- **How:** `npm ci && npm run typecheck && npm run lint && npm run format:check && npm test`
- **Expected:** every command exits 0; vitest reports contracts 47, api 268 and web 325 tests passed.

### Step 2 — Integration tests on PostgreSQL 16 (`F-DB-04`, `F-ECOMM-02`, `F-ECOMM-04`, `F-BE-08`, `F-BE-09`)

- **Where:** repository root, with a disposable PostgreSQL 16 database (it is wiped).
- **How:** `docker run -d --rm --name w01-pg -e POSTGRES_PASSWORD=pg -p 55432:5432 postgres:16-alpine` then
  `TEST_DATABASE_URL=postgres://postgres:pg@localhost:55432/postgres npm run test:integration`
- **Expected:** `Test Files 9 passed`, `Tests 117 passed`. This covers identity (including INV-09), media (upload, serve, cleanup job)
  and notifications-write (dedupe, `deleteFor`, rollback).

### Step 3 — Wave audit and spec validation

- **Where:** repository root.
- **How:** `node .yardos/skills/wave-validate/scripts/validate-wave.mjs --root . --wave w01 --require-guide --json` and
  `node .agents/skills/spec-architect/scripts/validate-specs.mjs --root . --json`
- **Expected:** `"ok": true` with empty `errors`, and `gaps_file_path` is `docs/questions-and-limitations/w01-gaps.md`; the spec validator reports `"valid": true`.

### Step 4 — Render the slot-1 compose bundle (`F-INFRA-04`)

- **Where:** repository root.
- **How:** `node .yardos/skills/wave-compose-deploy/scripts/compose-wave.mjs --root . --project insta --wave w01 --slot-index 1 --render-only --json`
- **Expected:** `"compose_project": "yd-insta-w01"`, `"port_base": 21020`, web → `21020`, api → `21021`; `.yardos/waves/w01/compose.wave.yml` publishes no host port for `db`.

### Step 5 — Start the w01 stack

- **Where:** a Docker host, at the repository root.
- **How:** create `.yardos/waves/w01/compose.local.yml` with
  `services: { api: { environment: { PUBLIC_URL: "http://localhost:21020", PUBLIC_API_URL: "http://localhost:21021", CORS_ORIGIN: "http://localhost:21020" } }, web: { environment: { PUBLIC_URL: "http://localhost:21020", PUBLIC_API_URL: "http://localhost:21021" } } }`
  then run
  `export POSTGRES_PASSWORD=$(openssl rand -hex 16) && docker compose --project-directory . -p yd-insta-w01 -f .yardos/waves/w01/compose.base.yml -f .yardos/waves/w01/compose.wave.yml -f .yardos/waves/w01/compose.local.yml --env-file .yardos/waves/w01/.env.wave up -d --build --wait`
  (skip the override when testing through the Hoster proxy).
- **Expected:** exits 0 with `db`, `api`, `web` all `Healthy`; `curl http://localhost:21021/api/v1/health` → `200 {"status":"ok","db":"ok",…}`.

### Step 6 — Signup with auto-login, duplicate handling (`F-ECOMM-02`, `F-BE-01`)

- **Where:** `POST http://localhost:21021/api/v1/auth/signup`
- **How:** `curl -s -X POST localhost:21021/api/v1/auth/signup -H 'content-type: application/json' -d '{"username":"Owner_1","email":"Owner@Example.com","password":"password123","full_name":"Owner"}'`; repeat with the same username and a new email, then with a new username and the same email.
- **Expected:** first call `201` with `token_type: "Bearer"`, a 43-char `access_token`, `expires_at` 30 days ahead, and `user.username: "owner_1"`, `user.email: "owner@example.com"`, `avatar_url: null`, `is_following: null`. Repeats return `409` `USERNAME_TAKEN` and `409` `EMAIL_TAKEN`. One `users` row and one `sessions` row exist (`token_hash` = sha256 of the token; the raw token is never stored).

### Step 7 — Login: identical failures for wrong password and unknown user (`F-ECOMM-02`)

- **Where:** `POST http://localhost:21021/api/v1/auth/login`
- **How:** `-d '{"login":"OWNER@example.com","password":"password123"}'`, then `-d '{"login":"owner_1","password":"wrong"}'`, then `-d '{"login":"ghost","password":"wrong"}'`
- **Expected:** `200` with a new token (case-insensitive email login). Both failures return `401` with `error.code: "INVALID_CREDENTIALS"` and the same message, taking comparable time.

### Step 8 — Upload an avatar: type comes from magic bytes (`F-ECOMM-04`, `F-BE-02`)

- **Where:** `POST http://localhost:21021/api/v1/media` (multipart; text parts before `file`)
- **How:** copy any PNG to `clip.mp4`, then `curl -s -X POST localhost:21021/api/v1/media -H "authorization: Bearer $T" -F purpose=avatar -F "file=@clip.mp4;type=video/mp4"`; then upload a text file (`-F purpose=post -F file=@notes.txt`), an image over 10 MiB, and a video with `purpose=avatar`.
- **Expected:** PNG → `201` with `id: "med_…"`, `kind: "image"`, `mime_type: "image/png"`, real `width`/`height`, `url` ending `.png`, and a `media_assets` row with `status = 'uploaded'`. Text → `415 UNSUPPORTED_MEDIA_TYPE`. > 10 MiB → `413 PAYLOAD_TOO_LARGE` with no row and no file left. Avatar video → `400 VALIDATION_FAILED`. Without a token → `401`.

### Step 9 — Media serving headers and traversal (`F-ECOMM-04`)

- **Where:** the `url` from step 8, e.g. `http://localhost:21021/media/2026/11/<uuid>.png`
- **How:** `curl -s -D - -o /dev/null <url>`; `curl -s -o /dev/null -w '%{http_code}' --path-as-is localhost:21021/media/../package.json`
- **Expected:** `200`, `Content-Type: image/png`, `Cache-Control: public, max-age=31536000, immutable`, `Accept-Ranges: bytes`, `X-Content-Type-Options: nosniff`, no auth needed; the traversal request returns `404`.

### Step 10 — Edit profile and attach the avatar (`F-ECOMM-02`, `F-BE-01`)

- **Where:** `PATCH http://localhost:21021/api/v1/me`
- **How:** `-d '{"avatar_media_id":"<med_id from step 8>","bio":"hello\nworld","full_name":"Owner Two"}'`; then `-d '{}'`; then sign up a second user and PATCH that user with the first user's `med_…` id.
- **Expected:** `200` `MeResponseDto` with `avatar_url` = the media URL, the new bio and name; the media row becomes `status = 'attached'`. `{}` → `400 VALIDATION_FAILED`. Foreign media → `422 MEDIA_INVALID` and that profile is unchanged. `{"avatar_media_id":null}` → `avatar_url: null`.

### Step 11 — Public profile (`F-ECOMM-03`)

- **Where:** `GET http://localhost:21021/api/v1/users/OWNER_1`
- **How:** call it anonymously, with the owner's own token, and with an unknown username.
- **Expected:** `200` with `username: "owner_1"`, no `email` field, and `is_following: null` (anonymous and self alike), `has_active_story: false`. Unknown username → `404 NOT_FOUND`.

### Step 12 — Logout revokes only the current session (`F-ECOMM-02`)

- **Where:** `POST http://localhost:21021/api/v1/auth/logout`
- **How:** log in twice to get tokens A and B; logout with A; then `GET /api/v1/me` with A and with B; finally `docker compose -p yd-insta-w01 logs api | grep -c password123`.
- **Expected:** logout `204` with an empty body; `/me` with A → `401 UNAUTHENTICATED`, with B → `200`. A's `sessions.revoked_at` is set. The log grep prints `0` (passwords and tokens are redacted, INV-09).

### Step 13 — Web: signup → avatar → edit profile in a browser (`F-FE-02`, `F-FE-07`)

- **Where:** `http://localhost:21020/signup`, then `/settings/profile`, then `/login`.
- **How:** open `/settings/profile` logged out; sign up with `webuser` / `web@example.com` / `password123`; also try a taken username; on `/settings/profile` pick a PNG in the avatar uploader, type a 151-char bio and a bio with 5 line breaks, then a valid bio, and save; log out and log back in with `/login?next=/settings/profile`.
- **Expected:** logged out, `/settings/profile` redirects to `/login?next=…`. The taken username shows an inline "taken" error under the username field. After signup you are logged in. The uploader shows progress and a preview. The bio counter blocks saving above 150 chars or with more than 4 line breaks. Save shows the new avatar and it persists after a reload. Logout clears the session (localStorage) and protected pages then redirect to `/login`; login with `?next=` lands on `/settings/profile`.

### Step 14 — Media cleanup job (`F-BE-09`)

- **Where:** api container, `db` via `docker compose -p yd-insta-w01 exec db psql -U insta insta`.
- **How:** upload a post image (step 8, `purpose=post`) without attaching it; `UPDATE media_assets SET created_at = now() - interval '25 hours' WHERE status = 'uploaded';`; restart `api` (the first tick runs at startup, then every 10 min).
- **Expected:** the row is deleted and its file is gone from the `media` volume; the attached avatar remains. The api log shows `{ job: "media-cleanup", deleted: 1, durationMs: … }`.

### Step 15 — Tear down

- **Where:** repository root.
- **How:** `docker compose -p yd-insta-w01 down -v` (or `compose-wave.mjs --root . --project insta --wave w01 --down --json`).
- **Expected:** containers, network and the `db-data`/`media` volumes of `yd-insta-w01` are removed; other wave stacks are untouched.

## Open Questions & Limitations

- [ ] **QL-w01-01** (`F-ECOMM-04`, `external-communication`): `POST /api/v1/media` only reads text parts (`purpose`, `width`, `height`, `duration_ms`) that come before the `file` part; parts after the file are ignored, so a `duration_ms` sent after a video file returns `400 VALIDATION_FAILED`. external-communication/03 does not state this ordering rule (the web client `buildUploadForm` already appends fields first).
- [ ] **QL-w01-02** (`F-ECOMM-02`, `external-communication`): `PATCH /api/v1/me` re-sending the user's current `avatar_media_id` is a `200` no-op instead of `422 MEDIA_INVALID` (the asset is already `attached`); external-communication/02 and backend/02 are silent on this case.
- [ ] **QL-w01-03** (`F-CORE-01`, `specs`): There is no `owned_paths` prefix for domain-entity unit tests, so `User`/`Session`/`MediaAsset`/`Notification` entity tests live in `apps/api/test/unit/mappers/*.entity.test.ts` (W01-01's first run failed with `owned_paths_violation` for this reason).
- [ ] **QL-w01-04** (`F-CORE-01`, `specs`): The W01-06 task lists spec refs `F-BE-01`, `F-BE-02`, `F-ECOMM-02`, `F-ECOMM-04`, while the wave plan (docs/plan/waves/W01-identity-media.md) also covers `F-ECOMM-03`, `F-BE-08` (write side), `F-BE-09`, `F-FE-02`, `F-FE-07`, `F-CORE-03` and `F-DB-04`, all of which were delivered.
- [ ] **QL-w01-05** (`F-INFRA-04`, `infra`): Docker is not available in the validation sandbox, so the slot-1 compose stack (`yd-insta-w01`, web 21020, api 21021) was only rendered, not started, and the browser flow (signup → upload avatar → edit profile) was not clicked through. Substitute evidence: a live API smoke run on port 21021 against PostgreSQL 16.9 (signup, 409, identical 401s, avatar upload renamed `.mp4`, 415, PATCH /me, media serving headers, traversal 404, logout + token reuse 401, no secrets in logs) plus web component tests.
- [ ] **QL-w01-06** (`F-INFRA-05`, `infra`): As in QL-w00-07, the rendered `.yardos/waves/w01/.env.wave` has no `POSTGRES_PASSWORD`, so `compose-wave.mjs --up` fails unless it is exported in the calling shell.
- [ ] **QL-w01-07** (`F-INFRA-04`, `infra`): `.yardos/` is gitignored, so `.yardos/waves/w01/review-packet.json` and the compose bundle exist only in the validator's working tree and are not part of the wave branch.
- [ ] **QL-w01-08** (`F-BE-01`, `persistence`): `PgUserRepository.getProfileView` computes `has_active_story` with the database `now()` instead of the injected `Clock`, so fake-clock tests cannot move story expiry; correct in production.
- [ ] **QL-w01-09** (`F-BE-01`, `backend`): Replacing or removing an avatar leaves the previous `attached` media row and file in storage forever (known spec question `Q-06`); `MediaCleanupJob` only purges `uploaded` assets.
- [ ] **QL-w01-10** (`F-DB-04`, `infra`): The sandbox has no Docker or system Postgres; integration tests ran on `embedded-postgres` 16.9 installed under `$HOME` (`/tmp` is noexec). PGlite cannot run the advisory-lock test (QL-w00-26). All 117 integration tests pass on PostgreSQL 16.9; CI on `postgres:16-alpine` stays authoritative.
- [ ] **QL-w01-11** (`F-FE-02`, `frontend`): There is no Playwright E2E suite yet (`apps/web/e2e` is absent; scheduled for w07), so login/signup/logout/edit-profile flows are covered only by component tests with a mocked API.
- [ ] **QL-w01-14** (`F-BE-02`, `backend`): Should `MediaAsset.create` re-check size and dimension limits itself (it currently does, duplicating the streaming checks in `MediaService.upload`), or should only the upload path enforce them?
