# 02 — Auth & Users API

Features: `F-ECOMM-02` (auth), `F-ECOMM-03` (profiles). Entities: `ENT-User`, `ENT-Session`.

## Endpoints

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/v1/auth/signup` | none | `SignupRequestDto` | `201 AuthTokenResponseDto` | 400, 409 `USERNAME_TAKEN`/`EMAIL_TAKEN`, 429 |
| `POST /api/v1/auth/login` | none | `LoginRequestDto` | `200 AuthTokenResponseDto` | 400, 401 `INVALID_CREDENTIALS`, 429 |
| `POST /api/v1/auth/logout` | required | — | `204` | 401 |
| `GET /api/v1/me` | required | — | `200 MeResponseDto` | 401 |
| `PATCH /api/v1/me` | required | `UpdateProfileRequestDto` | `200 MeResponseDto` | 400, 401, 409 `USERNAME_TAKEN`, 422 `MEDIA_INVALID` |
| `GET /api/v1/users/{username}` | optional | — | `200 UserProfileResponseDto` | 404 |
| `POST /api/v1/events/ticket` | required | — | `201 SseTicketResponseDto` | 401 |

## DTO Schemas

```ts
// POST /auth/signup
type SignupRequestDto = {
  username: string;   // 3–30, ^[a-z0-9._]+$ after lowercasing; no leading/trailing '.'
  email: string;      // valid email, ≤ 254
  password: string;   // 8–128 chars
  full_name?: string; // 0–60, default ""
};

// POST /auth/login
type LoginRequestDto = {
  login: string;      // username or email, 1–254
  password: string;   // 1–128
};

type AuthTokenResponseDto = {
  access_token: string;      // opaque base64url, 43 chars
  token_type: "Bearer";
  expires_at: string;        // ISO UTC
  user: MeResponseDto;
};

type MeResponseDto = UserProfileResponseDto & {
  email: string;
};

// PATCH /me — at least one field required; unknown fields rejected
type UpdateProfileRequestDto = {
  username?: string;
  full_name?: string;
  bio?: string;                      // 0–150
  avatar_media_id?: string | null;   // med_… (purpose avatar, kind image) or null to remove
};

type UserProfileResponseDto = {
  id: string;                // usr_…
  username: string;
  full_name: string;
  bio: string;
  avatar_url: string | null;
  posts_count: number;
  followers_count: number;
  following_count: number;
  is_following: boolean | null;   // null for anonymous or self
  has_active_story: boolean;
  created_at: string;
};

// POST /events/ticket
type SseTicketResponseDto = {
  ticket: string;        // opaque, single-use
  expires_at: string;    // now + 60s
};
```

## Behaviour

- Signup creates the user and a session in one transaction and returns the token (auto-login).
- Login with unknown handle and wrong password take comparable time (dummy argon2 verify) and return the same `INVALID_CREDENTIALS`.
- Logout sets `revoked_at` on the current session only.
- `PATCH /me` with a new `avatar_media_id` marks the media `attached`; the previous avatar media stays in storage (cleanup is `Q-06`).
- Username lookups in path are case-insensitive (lowercased before query).

## Mapping (DTO ↔ Business)

| DTO | Business | Mapper |
|---|---|---|
| `SignupRequestDto` | `RegisterUserCommand { username, email, password, fullName }` | `mapSignupDtoToCommand` |
| `LoginRequestDto` | `LoginCommand { login, password, userAgent }` | `mapLoginDtoToCommand` |
| `UpdateProfileRequestDto` | `UpdateProfileCommand { userId, username?, fullName?, bio?, avatarMediaId? }` (public ID parsed) | `mapUpdateProfileDtoToCommand` |
| `IssuedSession + User` | `AuthTokenResponseDto` | `mapSessionToAuthTokenDto` |
| `UserProfileView` | `UserProfileResponseDto` / `MeResponseDto` | `mapUserProfileViewToResponseDto`, `mapUserToMeResponseDto` |
