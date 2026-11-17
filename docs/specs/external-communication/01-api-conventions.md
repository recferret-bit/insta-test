# 01 — API Conventions

Feature: `F-ECOMM-01`.

## Base URL & Versioning

- Base: `${PUBLIC_API_URL}/api/v1` (e.g. `http://localhost:18001/api/v1`).
- Breaking changes require `/api/v2`; additive fields are allowed in v1 (clients must ignore unknown fields).
- Media files: `${PUBLIC_API_URL}/media/<storage_key>` (outside `/api/v1`, no auth — keys are unguessable UUIDs).

## Headers

| Header | Direction | Rule |
|---|---|---|
| `Authorization: Bearer <token>` | request | Required on `auth: required` endpoints; optional elsewhere |
| `Content-Type: application/json` | both | All bodies except `POST /media` (`multipart/form-data`) |
| `X-Request-Id` | both | Accepted if 8–64 `[A-Za-z0-9-]` chars; else generated (UUID); always echoed |
| `Cache-Control: no-store` | response | All `/api/v1` responses |

## Auth Levels

| Level | Meaning |
|---|---|
| `none` | Token ignored |
| `optional` | Token used if valid (enables viewer fields); invalid/expired token → treated as anonymous |
| `required` | Missing/invalid/expired/revoked token → `401 UNAUTHENTICATED` |

## Error Envelope — `ErrorResponseDto`

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [{ "path": "caption", "message": "String must contain at most 2200 character(s)" }],
    "request_id": "6f1c…"
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `error.code` | `ErrorCode` | Stable machine code (below) |
| `error.message` | `string` | Human-readable English, safe to display |
| `error.details` | `{ path: string, message: string }[]` \| absent | Only for `VALIDATION_FAILED` |
| `error.request_id` | `string` | Correlates with logs |

## Error Code Catalog

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Body/query/path fails schema, malformed public ID, bad cursor |
| `UNAUTHENTICATED` | 401 | Missing/invalid/expired/revoked token on `required` endpoints |
| `INVALID_CREDENTIALS` | 401 | Login with unknown handle or wrong password (same response for both) |
| `FORBIDDEN` | 403 | Authenticated but not allowed (edit someone else's post, view viewers of someone else's story) |
| `NOT_FOUND` | 404 | Resource missing, soft-deleted, or expired (stories); unknown route |
| `USERNAME_TAKEN` | 409 | Signup/profile update with existing username |
| `EMAIL_TAKEN` | 409 | Signup with existing email |
| `PAYLOAD_TOO_LARGE` | 413 | Upload exceeds size limit, or JSON body > 64 KiB |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Upload whose sniffed type is not allowed |
| `MEDIA_INVALID` | 422 | Referenced media not owned by caller, wrong purpose/kind, already attached, or missing |
| `CANNOT_FOLLOW_SELF` | 422 | Follow own account |
| `RATE_LIMITED` | 429 | Rate limit exceeded; includes `Retry-After` |
| `INTERNAL` | 500 | Unexpected error (message generic) |

## Pagination

- Query: `?cursor=<opaque>&limit=<1..50>` (default `limit=20`).
- Response wrapper: `{ "items": [...], "next_cursor": "<opaque>" | null }`.
- Cursor = base64url(JSON sort key), e.g. `{"t":"2026-11-17T10:00:00.000Z","id":"<uuid>"}`; tampered/undecodable cursor → `400 VALIDATION_FAILED`.

## Common DTOs (`packages/contracts/src/dto/common.ts`)

```ts
type UserSummaryDto = {
  id: string;               // usr_…
  username: string;
  full_name: string;
  avatar_url: string | null;
  is_following: boolean | null; // null when anonymous or self
};

type MediaResponseDto = {
  id: string;               // med_…
  kind: "image" | "video";
  purpose: "post" | "story" | "avatar";
  mime_type: string;
  url: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  size_bytes: number;
  created_at: string;
};

type Page<T> = { items: T[]; next_cursor: string | null };
```

## CORS

- `Access-Control-Allow-Origin` = exact match against comma-separated `CORS_ORIGIN` list (no `*` in production).
- Allowed methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`; allowed headers: `Authorization, Content-Type, X-Request-Id`; exposed: `X-Request-Id, Retry-After`.
- `credentials: false` (bearer tokens, no cookies — `DEC-08`).

## Rate Limits (in-memory, per IP unless stated)

| Scope | Limit |
|---|---|
| `POST /auth/login`, `POST /auth/signup` | 10 / minute |
| `POST /media` | 30 / minute per user |
| Other mutating endpoints | 120 / minute per user |
| Reads | 600 / minute per IP |

## Health (no auth, outside versioned resources)

| Endpoint | Purpose | Response |
|---|---|---|
| `GET /healthz` | Liveness (process up) | `200 {"status":"ok"}` |
| `GET /api/v1/health` | Readiness (DB reachable, migrations applied) | `200 {"status":"ok","db":"ok","version":"<git sha>"}` or `503 {"status":"degraded","db":"down"}` |
