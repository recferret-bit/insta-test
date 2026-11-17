# W00 — Foundation: Workspace, Contracts, Schema v1, Platform Skeletons & Compose

| Field | Value |
|---|---|
| Wave | `w00` (`foundation`) |
| Depends on | — |
| Branch | `wave/w00-foundation` from `main` |
| Compose | `yd-insta-w00`, slot 0, ports 21000–21019 (web 21000, api 21001) |
| Migrations | `0001_init.sql` |
| Spec refs | `F-CORE-01..05`, `F-DB-01`, `F-DB-02`, `F-ICOMM-01`, `F-ICOMM-02`, `F-ECOMM-01`, `F-ECOMM-12`, `F-BE-10`, `F-FE-01`, `F-FE-11`, `F-FE-12`, `F-INFRA-01..07` |

## Goal

Freeze every shared contract and create every extension point, so waves `w01`–`w06` only change files inside their own
module prefixes. After this wave the stack builds, starts healthy in compose, serves `/healthz` and `/api/v1/health`,
resolves bearer sessions, and shows the SPA shell with placeholder pages. Every feature endpoint exists as a stub route
module, but its service method throws (`500 INTERNAL`) or the route is not yet registered.

## Specs to Read First

`docs/specs/specs/*` (all), `persistence/01-schema.md`, `persistence/02-migrations-and-indexes.md`, `persistence/03-row-mappers.md`,
`internal-communication/*`, `external-communication/01-api-conventions.md` (+ DTO blocks in 02–06),
`backend/01-business-entities.md`, `backend/03-ports-and-handlers.md`, `frontend/*`, `infra/*`.

## Task DAG

```text
W00-01 (contracts) ──┬── W00-02 API platform
                     ├── W00-03 Web platform
                     └── W00-04 Infra
                                └──► W00-05 validate (needs 02, 03, 04)
```

### W00-01 — Workspace tooling, `@insta/contracts`, schema v1 & domain kernel (`contracts`)

Owned paths: root `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`,
`.prettierignore`, `packages/contracts/`, `apps/{api,web}/package.json`, `apps/{api,web}/tsconfig.json`,
`apps/api/migrations/0001_init.sql`, `apps/api/src/domain/`, `apps/api/src/data/rows/`, `docs/specs/specs/01-project-structure.md`.

- npm workspaces; **the full dependency set** for all workspaces (Fastify 5, `fastify-type-provider-zod`, `@fastify/cors`,
  `@fastify/multipart`, `@fastify/rate-limit`, `pg`, `argon2`, `file-type`, `image-size`, `uuid` (v7), `zod`, React 18,
  React Router 6, TanStack Query 5, `lucide-react`, Vite 5, Vitest, Playwright, ESLint + `eslint-plugin-import`, Prettier, `tsx`).
  Feature waves will not add dependencies.
- ESLint flat config with `import/no-restricted-paths` for the module-boundary table (`F-CORE-02`, `F-BE-10`).
- `packages/contracts`: `ids.ts`, `errors.ts`, `pagination.ts`, `limits.ts`, every `dto/*.ts`, `events.ts`, `index.ts`;
  request schemas `.strict()`; builds standalone with `tsc -b`.
- `0001_init.sql`: every table, constraint and index from the persistence spec, in the FK order given there.
- `domain/shared/`: branded IDs, `DomainError` + `ErrorCode` copy, `Clock` (+ `SystemClock`), `IdGenerator` port,
  `UnitOfWork`/`Tx`/`EventCollector`, `DomainEvent` union, `DomainEventPublisher`, `Page`/`PageRequest`/`TimeCursor`.
- For every module (`identity`, `media`, `posts`, `social`, `stories`, `notifications`, `feed`, `search`):
  `ports.ts` (exact interfaces from backend/03), `*.entity.ts` type declarations, `views.ts` read models,
  `<name>.service.ts` class skeletons with the constructor ports and method signatures from backend/02 (bodies throw).
  Exception: `IdentityService.authenticate` is implemented (sha256 → `SessionRepository.findActiveByTokenHash`).
- `data/rows/<group>.row.ts` for every table (users, sessions, media, posts, likes, comments, follows, stories, notifications).
- Document the frozen file map from [PRODUCT_WAVES.md](../PRODUCT_WAVES.md#frozen-module-file-map-owned-path-vocabulary) in `01-project-structure.md`.

### W00-02 — API platform, composition root, stubs & test harness (`worker`)

Owned paths: `apps/api/src/{main.ts,config,api,jobs}`, `apps/api/src/data/{db,storage,crypto,repositories,mappers}`,
`apps/api/test/`, `apps/api/scripts/`, `apps/api/vitest*.config.ts`.

- `config/env.ts` (Zod; exit non-zero listing invalid keys). `data/db`: pool, `PgUnitOfWork` (publish collected events
  only after `COMMIT`), migration runner (advisory lock, checksum table, fatal on changed file).
- `InProcessEventBus` (microtask fan-out, isolated handler failures). `data/crypto`: argon2id hasher, token generator, UUIDv7.
  `data/storage`: `LocalMediaStorage`, `MediaProbe`.
- `api/server.ts`: zod type provider, CORS from `CORS_ORIGIN`, `X-Request-Id`, `Cache-Control: no-store`, pino redact,
  rate limits per api-conventions, 64 KiB JSON limit, central error handler (DomainError / ZodError / 404 / 500).
- `auth.plugin.ts`: route `config.auth` = `required | optional | none`; working bearer resolution (`sessions.pg-repository.ts`
  `findActiveByTokenHash` implemented here; the rest of the repository is completed by w01).
- `/healthz` and `/api/v1/health` (DB `SELECT 1` + latest migration).
- `api/routes/index.ts` registers: `identity, media, posts, likes, comments, social, stories, feed, search, notifications, events` —
  each an empty plugin file that the owning wave fills. `api/sse/index.ts` exports a no-op `createSseHub`.
- Stub pg repositories for every port; `jobs/index.ts` with `media-cleanup.job.ts` + `story-cleanup.job.ts` stubs and a
  runner that takes `pg_try_advisory_lock`, honours `JOBS_ENABLED`, starts after listen. Graceful shutdown.
- `main.ts` wires config → pool → repos → services → event bus → SSE hub → server → jobs.
- Test harness `apps/api/test/helpers/`: `buildTestApp()`, `resetDb()` (fresh schema + migrations), SQL-level factories for
  every table (`insertUser`, `insertMedia`, `insertPost`, `insertFollow`, `insertStory`, …), `createAuthedUser()` → bearer token.

### W00-03 — Web platform (`worker`)

Owned paths: `apps/web/{index.html,vite.config.ts,vitest.config.ts,nginx,public,src}`.

- `config.ts` reading `window.__APP_CONFIG__`; `styles/tokens.css` + `global.css` (light/dark via `prefers-color-scheme` + manual toggle).
- Design-system primitives in `ui/components/`: `Button`, `Input`, `TextArea`, `Avatar` (+ story-ring variant), `UserRow`,
  `Modal`, `Sheet`, `Skeleton`, `EmptyState`, `Spinner`, `Toast` region, `Icon` wrapper. Names reserved for feature waves
  (e.g. `PostCard*`, `StoryTray*`) must not be created here.
- `ui/layout/`: `AppShell` (desktop sidebar ≥ 768 px, mobile top + bottom bars), `RequireAuth`, `PublicOnly`, route error boundary.
- `App.tsx` route table from `frontend/01` importing `ui/pages/index.ts`; one placeholder file per page
  (`LoginPage.tsx`, `SignupPage.tsx`, `HomePage.tsx`, …, `NotFoundPage.tsx`).
- Complete typed API client `src/api/` (`http.ts`, `auth.ts`, `users.ts`, `media.ts` with XHR progress, `posts.ts`,
  `comments.ts`, `stories.ts`, `search.ts`, `notifications.ts`, `events.ts`).
- `state/session.ts`, query client + query-key factory, `patchPostInCaches`, every `DTO → ViewModel` mapper in
  `state/mappers/` (feature waves later own and refine their module's mapper), stub `state/notifications.ts` (unread badge
  hook returning 0) and `state/sse.ts` (no-op connection manager) mounted by the shell.
- nginx `default.conf.template` + `30-runtime-config.sh` per infra/01.

### W00-04 — Infra (`worker`)

Owned paths: `docker-compose.yml`, `docker-compose.dev.yml`, `apps/{api,web}/Dockerfile`, `.dockerignore`, `.env.example`,
`.github/workflows/`, `README.md`.

- Dockerfiles exactly per infra/01 (non-root api image < 250 MB). Compose: `db` (internal, `pg_isready`), `api`
  (healthcheck `/api/v1/health`, media volume), `web` (healthcheck `/healthz`); host ports from `WEB_HOST_PORT`/`API_HOST_PORT`.
- `.env.example` with every variable in infra/02. CI workflow with all 9 gates; the e2e step tolerates "no specs" until w07.

### W00-05 — Validate (`validate`)

Run `wave-validate` (2 iterations), compose preview on slot 0, two-stack side-by-side check (`F-INFRA-04`). Outputs:
`docs/questions-and-limitations/w00-gaps.md`, `docs/plan/checks/w00-check.md`, `.yardos/waves/w00/review-packet.json`.

## Acceptance Criteria

- `npm ci && npm run build && npm run lint && npm run typecheck && npm test` pass from the repo root.
- `npm run test:integration` passes: migrations apply on an empty DB; re-running is a no-op; editing an applied file aborts start.
- Information-schema test asserts every table/column/constraint/index from `persistence/01` and `02` exists (`F-DB-01`).
- Unit tests: `toPublicId`/`parsePublicId` round trip + bad prefix → `VALIDATION_FAILED`; `ErrorCode` lists in domain and
  contracts are equal; `LIMITS` equal domain constants; rolled-back UoW publishes no events (`F-ICOMM-02`).
- A test-only route proves the error envelope for 400/401/404/500 and `X-Request-Id` echo; `required` auth with a revoked
  or expired session token → `401 UNAUTHENTICATED`.
- An ESLint fixture importing `pg` from `domain/` fails lint.
- `docker compose up -d --build --wait` → all healthy; `GET :API/api/v1/health` = 200; `GET :WEB/healthz` = 200;
  `GET :WEB/config.js` contains `apiUrl`. `db` publishes no host port.
- SPA shell renders on desktop and mobile widths; protected placeholder routes redirect to `/login?next=…`.

## Out of Scope

All feature business logic (w01–w06). E2E specs (w07).
