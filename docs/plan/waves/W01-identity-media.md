# W01 — Identity, sessions, profiles & media upload

- **Wave:** `w01` · branch `wave/w01-identity-media` from `main` after `w00` lands · depends on: `w00`
- **Preview:** slot 1 → web `21020`, api `21021` (`yd-insta-w01`)
- **Exact `owned_paths`:** see `w01` in [WAVE_MANIFEST.json](../WAVE_MANIFEST.json)
- **Specs:** `ENT-User`, `ENT-Session`, `ENT-Media` in [03-domain-and-entity-map.md](../../specs/specs/03-domain-and-entity-map.md); [external-communication/02](../../specs/external-communication/02-auth-and-users-api.md), [03 (media part)](../../specs/external-communication/03-media-and-posts-api.md); backend IdentityService/MediaService; frontend `/login`, `/signup`, `/u/:username`, `/settings/profile`

## Goal

Users can sign up, log in, log out, view and edit their own profile (with an avatar upload) and view other profiles. Media upload, serving and cleanup work for every purpose (`post`, `story`, `avatar`), so w02 and w04 can attach media.

## Tasks

| Task | Kind | Scope | Spec refs |
|---|---|---|---|
| W01-01 | contracts | Re-check auth/users/media DTOs and identity/media ports. Implement the shared slice: `Session` + `SessionAuthenticator` (P-1), token generator, session and media row mappers + repositories, `MediaAsset` entity (`assertAttachable`, `attach`). Raw-SQL `identity-fixtures.ts` (user + session with a known raw token) and `media-fixtures.ts`. | F-CORE-03, F-DB-04, F-ECOMM-02 |
| W01-02 | worker | `User` entity + value objects, `IdentityService`, argon2id hasher, user row mapper (incl. `mapUserSummaryViewRow(row, prefix)` reused by later waves) + repository, `auth.routes.ts`, `users.routes.ts`, auth/user DTO mappers. Logout also calls `SseHub.closeSession`. | F-BE-01, F-ECOMM-02, F-ECOMM-03 |
| W01-03 | worker | `MediaService`, `data/probe` (magic-byte sniffing, image size), `media.routes.ts` (`POST /api/v1/media`, `GET /media/{key}`), media DTO mapper, `MediaCleanupJob`. | F-BE-02, F-ECOMM-04, F-BE-09 |
| W01-04 | worker | `LoginPage`, `SignupPage`, `ProfilePage`, `EditProfilePage`, `ui/components/profile`, `state/auth.ts`, `state/profile.ts`, `state/mappers/{auth,profile}.ts`. | F-FE-02, F-FE-06, F-FE-07 |
| W01-05 | validate | wave-validate ×2; `w01-check.md`, `w01-gaps.md`, review packet. | — |

## Acceptance criteria

- Signup/login return `AuthTokenResponseDto`. Only the SHA-256 of the token is stored. Login gives the same `INVALID_CREDENTIALS` for an unknown user and a wrong password. Logout revokes the session and closes its SSE streams.
- `PATCH /me` with `avatar_media_id` attaches an owned, unattached `image`/`avatar` asset in one tx. Anything else returns `422 MEDIA_INVALID`.
- `GET /users/{username}` returns counters, `is_following` (`null` when anonymous or viewing yourself; real values arrive with w03 data) and `has_active_story`.
- Upload sniffs the type from magic bytes (`415`), enforces 10 MiB / 50 MiB (`413`) and requires `duration_ms` for video. `GET /media/{key}` sends the right `Content-Type` and `Cache-Control: public, max-age=31536000, immutable`.
- `MediaCleanupJob` deletes unattached assets older than 24 h, together with their files.
- Web: forms show server `details[]` errors next to the matching fields. The `?next=` redirect works. Edit profile sends only the changed fields. The profile page renders the w00 stubs for the follow button and the grid.

## Tests required

Unit: `User.register` rules (reserved names, regex, trimming), service with fake ports, every mapper round-trip, web mappers. Integration: every endpoint above with happy path + `401` + `400`, upload type and size limits, cleanup job with a shifted `Clock`.

## Cross-wave notes

- `ProfilePage` imports `FollowButton`/`FollowListModal` (w03) and `PostGrid`/`useUserPosts` (w02) only through the w00 stubs. Do not edit those files.
- Fixtures insert users and sessions with raw SQL, so W01-03 can test uploads before W01-02 is merged.
