# W01 — Identity, Sessions, Media Pipeline & Notification Write Side

| Field | Value |
|---|---|
| Wave | `w01` (`identity-media`) |
| Depends on | `w00` |
| Branch | `wave/w01-identity-media` from `main` (after w00 lands) |
| Compose | `yd-insta-w01`, slot 1, ports 21020–21039 (web 21020, api 21021) |
| Migrations | none |
| Spec refs | `F-BE-01`, `F-BE-02`, `F-BE-08` (write side), `F-BE-09` (media cleanup), `F-ECOMM-02..04`, `F-FE-02`, `F-FE-07`, `F-CORE-03`, `F-DB-04` |

## Goal

Real accounts and media. Users can sign up, log in, log out, read and edit their profile (incl. avatar upload), view
other profiles, and upload photos/videos that are served from the media volume. Unattached uploads are purged after 24 h.
The notification repository write side is ready for w02/w03 to call inside their transactions.

## Specs to Read First

`specs/03-domain-and-entity-map.md` (ENT-User, ENT-Session, ENT-Media, ENT-Notification), `backend/01`, `backend/02`
(IdentityService, MediaService, NotificationService note), `backend/03` (ports, jobs), `external-communication/01`, `02`,
`03` (media part), `persistence/01`, `03`, `frontend/01` (login, signup, settings), `frontend/02`.

## Endpoints in Scope

| Endpoint | Route file | Task |
|---|---|---|
| `POST /api/v1/auth/signup`, `POST /auth/login`, `POST /auth/logout` | `identity.routes.ts` | W01-02 |
| `GET /api/v1/me`, `PATCH /api/v1/me` | `identity.routes.ts` | W01-02 |
| `GET /api/v1/users/{username}` | `identity.routes.ts` | W01-02 |
| `POST /api/v1/media` (multipart), `GET /media/*` | `media.routes.ts` | W01-03 |

`POST /events/ticket` (DTO in `dto/auth.ts`) is implemented by w06.

## Task DAG

```text
W01-01 (contracts) ──┬── W01-02 Identity & sessions API
                     ├── W01-03 Media upload, serving & cleanup job
                     ├── W01-04 Notification persistence (write side)
                     └── W01-05 Web auth pages & edit profile
                                └──► W01-06 validate
```

### W01-01 — Freeze identity/media/notification entities & mappers (`contracts`)

- Confirm `dto/common.ts`, `auth.ts`, `users.ts`, `media.ts` against the spec (additive, spec-backed fixes only).
- Entities: `User.register` (username/email/full name/bio rules, reserved names), `Session` (expiry, revocation),
  `MediaAsset` (`assertAttachable(purpose, kind?)`, `attach()` `uploaded → attached`), `Notification.create`
  (never actor = recipient; `post_id`/`comment_id` rules per type). `UserProfileView`, `UserSummaryView` in `identity/views.ts`.
- Row mappers + round-trip tests for `users`, `sessions`, `media_assets`, `notifications`.
- Web `toUserSummaryVM`, `toProfileVM`, `toMeVM`, `toMediaVM` tests (compact counts, initials avatar fallback, aspect clamp).

### W01-02 — Identity & sessions API (`worker`)

- `IdentityService` methods per backend/02 (dummy argon2 verify for unknown login; register = user + session in one tx).
- `users.pg-repository.ts` (23505 → `USERNAME_TAKEN` / `EMAIL_TAKEN`; `getProfileView` with `is_following` and
  `has_active_story` `EXISTS`), `sessions.pg-repository.ts` (`insert`, `revoke`; keep w00's `findActiveByTokenHash`).
- `PATCH /me` with `avatar_media_id` attaches an `avatar`/`image` asset in the same tx; `null` clears it.

### W01-03 — Media upload, serving & `MediaCleanupJob` (`worker`)

- Stream upload: sniff first 4100 bytes, reject non-allowed (`415`), abort at limit (`413`: image 10 MiB, video 50 MiB),
  probe image dimensions, require `duration_ms` for videos (1–60000) and bounds-check dims, avatar must be image; delete
  the file if the DB insert fails. Storage key `<yyyy>/<mm>/<uuid>.<ext>`.
- `GET /media/*`: correct `Content-Type`, `Cache-Control: public, max-age=31536000, immutable`, no auth, path traversal rejected.
- `media-cleanup.job.ts`: advisory lock, batches of 500, deletes rows then files, logs `{ job, deleted, durationMs }`.

### W01-04 — Notification persistence write side (`worker`)

- `notifications.pg-repository.ts`: `insertIfAbsent` (`ON CONFLICT DO NOTHING` on the partial unique indexes → returns
  whether a row was inserted), `deleteFor({type:'like'|'follow', …})`. Read methods stay stubs for w06.

### W01-05 — Web auth pages, edit profile & upload hook (`worker`)

- `LoginPage`, `SignupPage` (inline field errors from `VALIDATION_FAILED.details`, `409` mapped to the field, `?next=` redirect),
  logout (clear session + query cache), `state/me*` hook, `state/auth*` mutations.
- `state/upload*`: upload hook with progress + cancel, reused by w02/w04.
- `EditProfilePage` with `AvatarUploader` (purpose `avatar`), username, full name, bio (150 chars, ≤ 4 newlines) + counters.

### W01-06 — Validate (`validate`)

2-iteration `wave-validate`, compose preview on slot 1 (signup → upload avatar → edit profile in a browser). Outputs
`w01-gaps.md`, `w01-check.md`, `review-packet.json`.

## Acceptance Criteria

- Each endpoint: integration tests for happy path, `401`, `400`; bodies parsed with contracts schemas.
- Duplicate username/email → `409` with the right code; login with wrong password and with unknown user return identical
  `401 INVALID_CREDENTIALS`; logout then reuse token → `401`.
- Password hash and raw token never appear in any response except the signup/login token (`INV-09`); logs redact them.
- Upload: PNG renamed `.mp4` is accepted as `image/png`; a text file is `415`; an 11 MiB image is `413`; avatar video is
  `400 VALIDATION_FAILED`; attaching someone else's media → `422 MEDIA_INVALID`.
- Media cleanup job deletes only `uploaded` assets older than 24 h (fake clock) and removes their files.
- Notification write tests: second like-notification insert for same (recipient, actor, post) returns `false`; `deleteFor` removes it.
- Web: signup/login/logout/edit-profile flows covered by component tests; protected routes redirect when logged out.

## Out of Scope

Follow endpoints (w03), user post grid (w02), SSE ticket (w06), profile page UI (w05).
