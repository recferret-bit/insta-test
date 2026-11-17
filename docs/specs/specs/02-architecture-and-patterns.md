# 02 — Architecture & Patterns

Features: `F-CORE-02` (layer dependency rule), `F-CORE-05` (uniform errors).

## Architectural Style

Layered / hexagonal monolith in a single API process, plus a static SPA:

```text
 Browser (React SPA)
   │  REST JSON /api/v1/*  (Bearer token)
   │  SSE /api/v1/events/stream (one-time ticket)
   ▼
 apps/api ── api/ (Fastify routes, Zod validation, DTO mappers, auth, SSE hub)
              │ calls
              ▼
            domain/ (Business Entities, services = use cases, ports, domain events)
              ▲ implements ports
              │
            data/ (pg repositories, Row types, Row mappers, local media storage)
              │
              ▼
          PostgreSQL 16          Media volume (/data/media)
```

- **Dependency direction:** `api → domain ← data`. Domain defines ports (TypeScript interfaces); data implements them. `main.ts` wires concrete adapters via constructor injection (no DI container).
- **Thin handlers:** a route handler does exactly: parse/validate request (Zod) → map DTO to command → call one service method → map result entity/read model to Response DTO → reply. No SQL, no business rules in handlers.
- **Services = use cases:** one class per module (`PostService`, `FollowService`, …) exposing intention-revealing methods (`createPost`, `follow`, …). Services own transactions through the `UnitOfWork` port.
- **Read models:** feed, profile, and search queries return dedicated read-model types (e.g. `PostView`, `UserProfileView`) built by repository query methods with joins, instead of N+1 entity loading.

## Validation Boundaries

| Boundary | Mechanism |
|---|---|
| HTTP request (body, params, query) | Zod schemas from `@insta/contracts`; failure → `400 VALIDATION_FAILED` with `details[]` (path + message) |
| HTTP response | Response DTO schemas are used as Fastify serializers in dev/test (`RESPONSE_VALIDATION=strict`) to catch drift |
| Domain | Entity factories (`Post.create`, `User.register`) enforce invariants and throw `DomainError` |
| Database | `CHECK`, `NOT NULL`, `UNIQUE`, `FK` constraints are the last line of defense; unique violations are translated to domain conflict errors by repositories |
| Env config | `config/env.ts` parses `process.env` with Zod at startup; invalid config → process exits non-zero |
| SSE payloads | Event schemas in `@insta/contracts/events.ts`; the web client validates each event with `safeParse` and drops invalid ones |

## Error Handling

- Domain throws `DomainError(code, message, details?)` where `code` is a member of the `ErrorCode` union (shared literal list; domain keeps its own copy of codes to avoid importing contracts, kept in sync by a unit test).
- `api/server.ts` has one `setErrorHandler` that maps: `DomainError` → status from the code table; `ZodError` → 400; Fastify 404 → `NOT_FOUND`; anything else → `500 INTERNAL` (message hidden, logged with `request_id`).
- Repositories never leak `pg` errors: `23505` (unique violation) → specific conflict `DomainError`; `23503` (FK) → `NOT_FOUND` or `VALIDATION_FAILED` depending on context.

## Transactions & Consistency

- `UnitOfWork.run(async (tx) => …)` opens a `BEGIN … COMMIT` on a single pooled client; repositories accept the `tx` handle.
- Denormalized counters (`users.posts_count`, `followers_count`, `following_count`, `posts.like_count`, `comment_count`) are updated in the **same transaction** as the row insert/delete that changes them, using `UPDATE … SET x = x + 1` (never read-modify-write in app code).
- Domain events are collected during the transaction and published to the in-process event bus **after commit** only (see [internal-communication/02-domain-events-and-sse.md](../internal-communication/02-domain-events-and-sse.md)).

## Authentication & Authorization Pattern

- `auth.plugin.ts` resolves `Authorization: Bearer <token>` → `AuthContext { userId, sessionId }` by SHA-256 hashing the token and looking up an active session.
- Routes declare `auth: "required" | "optional" | "none"`. Optional auth enables viewer-dependent fields (`viewer_has_liked`, `is_following`).
- Ownership checks (edit/delete own post/comment, view own story viewers) are done in services, not handlers.

## Logging & Observability

- Fastify pino logger, JSON lines, `request_id` from `X-Request-Id` header or generated; echoed back in the response header and in error bodies.
- Never log tokens, password, `Authorization` header, or full request bodies of `/auth/*` (pino `redact`).

## Testing Pyramid

| Level | Scope | Tooling | Target |
|---|---|---|---|
| Unit | Entities, value objects, services with in-memory fake ports, all mappers (round-trip) | Vitest | ≥ 80 % lines in `domain/` and `*mapper*` files |
| Integration | Route → service → pg repository against real Postgres (compose `db` or CI service container); migrations applied fresh per run | Vitest + `fastify.inject` | Every endpoint: happy path + one auth failure + one validation failure |
| Contract | Response bodies parsed with `@insta/contracts` schemas inside integration tests | Zod | 100 % of endpoints |
| E2E smoke | Sign up → upload → post → like → comment → follow → story, in the compose stack | Playwright | 1 happy-path spec in CI |

## Coding Conventions

- File names: `kebab-case.ts`; types/classes `PascalCase`; functions `camelCase`; SQL identifiers `snake_case`; wire JSON fields `snake_case`.
- Mapper naming: `map<From>To<To>` (e.g. `mapPostRowToEntity`, `mapPostViewToResponseDto`).
- No default exports except React page components.
- Time is injected via a `Clock` port (`now(): Date`) so expiry logic (stories, sessions) is testable.
