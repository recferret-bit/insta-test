# 04 — Architectural Decisions & Invariants

## Decisions

| ID | Decision | Rationale | Source |
|---|---|---|---|
| `DEC-01` | Modular layered monorepo: `apps/api` (api/domain/data), `apps/web`, `packages/contracts`, with strict DTO ↔ Entity ↔ Row mappers. | Owner decision; clear ownership for parallel waves. | Owner Q&A (specs) |
| `DEC-02` | Minimal React SPA with a typed API client built on `@insta/contracts` types. | Owner decision; one frontend surface covers all workflows. | Owner Q&A (frontend) |
| `DEC-03` | REST JSON under `/api/v1/*`, Zod validation at every boundary, structured error codes, opaque bearer session tokens. | Owner decision. | Owner Q&A (backend) |
| `DEC-04` | PostgreSQL 16; `uuid` PKs generated app-side as UUIDv7; wire IDs are `<prefix>_<32 hex>`; forward-only numbered SQL migrations; explicit indexes for every query path. | Owner decision; UUIDv7 gives time-ordered keys good for index locality and cursor tie-breaks. | Owner Q&A (persistence) |
| `DEC-05` | In-process service calls and an in-process typed event bus; live updates pushed over SSE (server → client only). WebSocket is not used. | Owner decision; all live needs are one-directional (notifications, counters). | Owner Q&A (internal-communication) |
| `DEC-06` | No external third-party integrations: media stored on a local Docker volume and served by the API; no email, push, CDN, OAuth, or analytics providers. | Owner decision. | Owner Q&A (external-communication) |
| `DEC-07` | Docker Compose stack with health-checked `web` and `api` + internal `db`; configured via `PUBLIC_URL`, `PUBLIC_API_URL`, `CORS_ORIGIN`; host ports derived from `WAVE_PORT_BASE`. | Owner decision; per-wave isolated previews. | Owner Q&A (infra) |
| `DEC-08` | Session token stored by the SPA in `localStorage` and sent as `Authorization: Bearer`; no auth cookies → no CSRF surface. SSE uses a 60-second one-time ticket because `EventSource` cannot send headers. | Keeps cross-origin `web`/`api` deployment simple. XSS-token-theft trade-off recorded as `Q-03`. | Architect |
| `DEC-09` | Feed is fan-out-on-read: `posts WHERE author_id IN (followees ∪ self)` ordered by `(created_at, id)` with keyset pagination. | Simple and correct at this scale; no feed table to keep consistent. | Architect |
| `DEC-10` | All list endpoints use opaque keyset cursors (base64url JSON of the sort key), never `OFFSET`. | Stable pagination under inserts; index friendly. | Architect |
| `DEC-11` | Denormalized counters on `users` and `posts`, updated in the same transaction as the source row change. | Cheap profile/feed reads. | Architect |
| `DEC-12` | All accounts are public; no private accounts, follow requests, blocking, or DMs in v1. | Scope control; recorded as `Q-01`. | Architect |
| `DEC-13` | No server-side video transcoding or image resizing in v1. Images are served as uploaded (size-capped); video metadata is client-supplied and bounds-checked. | No ffmpeg/sharp native deps; recorded as `Q-02`. | Architect |
| `DEC-14` | Posts and comments are soft-deleted (`deleted_at`); stories, likes, follows, story views are hard-deleted. | Soft delete keeps notification/comment referential history; ephemeral data is simply removed. | Architect |
| `DEC-15` | Single API replica assumed for SSE fan-out and SSE ticket store (in-memory). Scheduled jobs take a Postgres advisory lock so a second replica would not double-run them. | Simplicity; horizontal scaling recorded as `Q-04`. | Architect |

## Global Invariants

| ID | Invariant |
|---|---|
| `INV-01` | A user cannot follow themselves (`CHECK` + `CANNOT_FOLLOW_SELF`). |
| `INV-02` | A user likes a post at most once (PK `(post_id, user_id)`). |
| `INV-03` | A post has 1–10 media items with contiguous positions `0..n-1`; each media asset belongs to at most one post/story/avatar. |
| `INV-04` | Only the owner of a media asset can attach it, and only for its declared `purpose`. |
| `INV-05` | Counters are never negative and always equal the count of live source rows (verified by an integration test that recomputes them). |
| `INV-06` | Stories are visible only while `now() < expires_at`; `expires_at = created_at + 24h`. |
| `INV-07` | Deleted posts/comments are invisible to every read endpoint and cannot be liked/commented. |
| `INV-08` | Self-actions (liking own post, commenting own post) never create notifications. |
| `INV-09` | Password hashes and raw session tokens never leave the API process except the token in the login/signup response. |
| `INV-10` | Only the author can edit/delete a post or delete a story; a comment can be deleted by its author or by the post's author. |

## Glossary

| Term | Meaning |
|---|---|
| Feed | Reverse-chronological posts by accounts the viewer follows plus the viewer's own posts. |
| Explore | Reverse-chronological posts by everyone except the viewer, shown as a grid. |
| Story tray | Horizontal list of followed users (and self) who have at least one active story; unseen first. |
| Viewer | The authenticated user making a request (may be absent for optional-auth endpoints). |
| Wave | A batch of parallel implementation tasks with declared `owned_paths`; gaps go to `docs/questions-and-limitations/<wNN>-gaps.md`. |
| Read model / View | Query-optimized projection (e.g. `PostView`) joining several tables, mapped directly to a Response DTO. |
