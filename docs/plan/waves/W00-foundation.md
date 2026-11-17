# W00 — Foundation: frozen contracts, schema v1, platform skeletons, stubs & compose

- **Wave:** `w00` · branch `wave/w00-foundation` from `main` · depends on: —
- **Preview:** slot 0 → web `21000`, api `21001` (`yd-insta-w00`)
- **Exact `owned_paths`:** see `w00` in [WAVE_MANIFEST.json](../WAVE_MANIFEST.json)
- **Specs to read first:** all of `docs/specs/specs/`, `internal-communication/01`, `persistence/01–03`, `backend/01–03`, `external-communication/01`, `frontend/01–03`, `infra/01–02`

## Goal

After w00, every later wave edits only its own module files. To get there, w00:

1. freezes every wire contract, the full DB schema, every domain port/type/service signature and every row type;
2. builds the API platform, web platform, design system and infra completely;
3. creates a **stub file** for every module file that a composition root or registry imports, so the repo compiles and the stubs are filled in later.

## Tasks

### W00-01 · `contracts` — Freeze workspace, contracts, schema v1, domain ports and module stubs

- npm workspaces: root `package.json` with every script from [infra/02](../../specs/infra/02-env-ci-and-probes.md#root-npm-scripts-planned-packagejson), `tsconfig.base.json` (strict, ESM, Node 22), and package/tsconfig files for `apps/api`, `apps/web` (+ `vite.config.ts`, `index.html`) and `packages/contracts`.
- `packages/contracts`: `ids.ts`, `errors.ts`, `pagination.ts`, `limits.ts`, every `dto/*.ts`, and `events.ts` (`ServerEvent` union), exactly as in the specs. Request schemas `.strict()`.
- `apps/api/migrations/0001_init.sql`: `pg_trgm`, every table in FK order, every constraint and every index in the index catalog.
- `apps/api/src/domain/shared`: branded IDs, `DomainError` + `ErrorCode` copy, `Clock`, `IdGenerator`, `PageRequest`/`Page`/`TimeCursor`, `UnitOfWork`/`Tx`/`EventCollector`/`DomainEventPublisher`, and the `DomainEvent` union.
- For each module (`identity`, `media`, `posts`, `social`, `stories`, `notifications`, `feed`, `search`): `ports.ts` (as in [backend/03](../../specs/backend/03-ports-and-handlers.md)), entity and read-model type declarations, and service classes with **frozen constructors** (the ports listed in [backend/02](../../specs/backend/02-services-and-use-cases.md)) and **frozen method signatures** whose bodies throw `NOT_IMPLEMENTED`. Also a stub `domain/identity/session-authenticator.ts` (P-1).
- `data/rows/<stem>.row.ts` with full row types. Stub `data/mappers/<stem>.row-mapper.ts`, `data/repositories/<stem>.pg-repository.ts` (constructor `(pool)`), `data/security/*`, `data/probe/*`.
- `api/routes/index.ts` listing the 13 route modules (`auth`, `users`, `media`, `posts`, `feed`, `likes`, `comments`, `follows`, `notifications`, `stories`, `search`, `events`, `health`), each with a stub `<module>.routes.ts` that registers nothing. Each route module exports `{ register(app, deps), prefix }` so `media.routes.ts` can also serve `/media/*` outside `/api/v1`. Stub `api/mappers/<stem>.dto-mapper.ts`. Stub `jobs/media-cleanup.job.ts` and `jobs/story-cleanup.job.ts`.
- Web stubs: `ui/pages/index.ts` exporting all 14 route pages (stub components). Cross-wave components with frozen props: `posts/PostCard`, `posts/PostGrid` (`items`, `loadMore`, `hasMore`), `social/LikeButton` (`postId`, `liked`, `likeCount`), `social/FollowButton` (`username`, `isFollowing`), `social/FollowListModal` (`username`, `kind`), `social/CommentSection` (`postId`, `postAuthorId`), `stories/StoryTray`, `profile/ProfileHeader`. Stub hooks with frozen signatures in `state/{auth,profile,posts,feed,comments,social,notifications,live,stories,search}.ts` (e.g. `useUserPosts(username)`, `useUnreadCount()`, `useLiveEvents()`).
- Record P-1…P-6 from [PRODUCT_WAVES.md](../PRODUCT_WAVES.md#6-planning-decisions-to-be-confirmed-by-the-owner) in `w00-gaps-W00-01.md`. If the specs themselves have a gap, fix `docs/specs` first and run spec validation until `"valid": true`.

**Done when:** `npm run build` and `npm run typecheck` pass for all workspaces with stubs in place.

### W00-02 · `worker` — API platform

`main.ts` (wires every stub repository and service, the auth plugin → `SessionAuthenticator`, the SSE hub, and jobs), `config/env.ts`, `api/server.ts`, `api/auth.plugin.ts`, `api/sse/*` (`SseTicketStore`, `SseHub`; `subscriptions.ts` stays a stub for w03), `health.routes.ts`, `events.routes.ts`, `api/mappers/common.dto-mapper.ts` + `url-builder.ts` (`toPublicId`/`parsePublicId`, cursor codec, `UserSummaryDto`, `MediaResponseDto`), `data/db` (pool, `UnitOfWork` with after-commit `InProcessEventBus`, `migrate.ts`), `data/storage/local-media-storage.ts`, `jobs/index.ts` + `runner.ts`, `vitest.config.ts`, and `test/helpers` (`buildTestApp`, `resetDb`, base SQL fixtures).

**Acceptance:** `F-CORE-05` error envelope for DomainError/Zod/404/500; `F-ICOMM-02` a rolled-back tx publishes nothing (unit test); `F-ICOMM-03` ticket is single-use with 60 s TTL and a 25 s heartbeat; `F-DB-02` the runner refuses a changed checksum; `F-INFRA-05` invalid env exits non-zero and lists the keys; `F-INFRA-07` `/healthz` and `/api/v1/health` (503 when the DB is down).

### W00-03 · `worker` — Web platform & design system

`main.tsx`, `App.tsx` (route table + `RequireAuth`/`PublicOnly` + error boundaries), `config.ts`, the complete typed client in `src/api/**` (every endpoint, XHR upload with progress), `state/session.ts`, `query-client.ts`, `form-errors.ts`, `theme.ts`, `mappers/common.ts`, `ui/layout` (sidebar / top + bottom bars, toast region, live manager + unread badge from stub hooks), `ui/components/primitives`, `styles/tokens.css` + `global.css`, `NotFoundPage`, and `apps/web/nginx`.

**Acceptance:** `F-FE-01` every route renders its stub and protected routes redirect to `/login?next=`; `F-FE-11` tokens with light/dark/system toggle and a visible focus ring; `F-FE-12` `/config.js` runtime config.

### W00-04 · `worker` — Infra & tooling

Dockerfiles, `docker-compose.yml`, `docker-compose.dev.yml`, `.dockerignore`, `.env.example`, `eslint.config.js` (layer rules for `F-CORE-02`), Prettier, `.github/workflows/ci.yml` (gates 1–7 + 9; the e2e gate is a placeholder until w06), and `README.md`.

**Acceptance:** `docker compose up -d --wait` brings db/api/web to healthy and only web/api publish ports; two stacks with different `COMPOSE_PROJECT_NAME` and ports run side by side; a deliberate `domain → pg` import fails lint.

### W00-05 · `validate`

Two-iteration `wave-validate`. Produces `docs/plan/checks/w00-check.md`, `docs/questions-and-limitations/w00-gaps.md` (merged from the `w00-gaps-W00-0X.md` notes) and `.yardos/waves/w00/review-packet.json`.

## Tests required

Unit tests for domain/shared, the ID/cursor codec, error mapping, env parsing, the event bus, the ticket store, web session/guards/common mappers. Integration tests: migrations on an empty DB, health endpoints, auth plugin with no/invalid token, SSE ticket reuse → 401.
