# Wave w00 — Foundation: Owner Check Guide

Branch `wave/w00-foundation` · compose project `yd-insta-w00` · slot 0 · web `http://localhost:21000` · api `http://localhost:21001`
(proxy URLs: `http://w00--insta.apps.localhost:9080`, `http://api--w00--insta.apps.localhost:9080`).

## Executive Summary

W00 sets up the foundation. It freezes every shared contract and creates every extension point, so that waves w01–w06 only
add files inside their own module prefixes. It delivers:

- An npm-workspaces TypeScript monorepo with ESLint layer-boundary rules.
- `@insta/contracts`, with Zod DTOs, IDs, error codes, limits and events.
- Schema v1 (`0001_init.sql`).
- The domain kernel, plus ports, entities and service skeletons for all eight modules.
- The Fastify API platform: config, a migration runner, a unit of work with after-commit events, an event bus, bearer auth, a central error handler, health probes, stub routes, repositories and jobs, and a test harness.
- The React SPA shell: design system, routing with auth guards, a typed API client, ViewModel mappers, and nginx runtime config.
- Dockerfiles, compose and CI.

W00-05 validation, iteration 1. These gates all pass:

| Check | Result |
|---|---|
| Spec validator | `valid: true` |
| Wave audit | `ok` |
| `npm run lint` | pass |
| `npm run format:check` | pass |
| `npm run typecheck` | pass |
| `npm run build` | pass (contracts, api, web) |
| Unit tests | 359/359 (contracts 47, api 97, web 215) |
| Integration tests | 41/41, against PGlite |

Two defects were found and fixed:

- **ESLint layer rules depended on the working directory.** `import/no-restricted-paths` was silently disabled whenever ESLint ran outside the repo root. `basePath` is now pinned to the config's directory, and six lint-fixture regression tests cover it. This also fulfils the acceptance criterion "ESLint fixture importing `pg` from `domain/` fails lint".
- **The wave compose render swapped web and api.** `api` was mapped to 21000 and `web` to 21001, and `PUBLIC_URL`/`CORS_ORIGIN` pointed at the API. `web` is now declared before `api` in `docker-compose.yml`.

Iteration 2 recorded 13 ledger items (2 of them resolved).

**Not executed here: anything that needs Docker.** That covers image builds, `compose up --wait`, live probes, the SPA in a browser, and two stacks running side by side. Steps 6–13 below are the owner's to run on a Docker host before landing.

## Delivered Features

- `F-CORE-01` Layered monorepo skeleton · `F-CORE-02` Strict layer dependency rule · `F-CORE-03` Three-layer entity mapping
- `F-CORE-04` Public prefixed IDs · `F-CORE-05` Uniform error model
- `F-DB-01` Schema v1 · `F-DB-02` Forward-only migrations
- `F-ICOMM-01` Shared contracts package · `F-ICOMM-02` In-process domain event bus
- `F-ECOMM-01` API conventions · `F-ECOMM-12` No third-party integrations · `F-BE-10` Thin handlers
- `F-FE-01` App shell & routing · `F-FE-11` Theming & a11y · `F-FE-12` Runtime config
- `F-INFRA-01` API image · `F-INFRA-02` Web image · `F-INFRA-03` Compose stack · `F-INFRA-04` Per-wave isolation
- `F-INFRA-05` Env configuration · `F-INFRA-06` CI gates · `F-INFRA-07` Health probes

## Step-by-Step Verification Guide

### Step 1 — Static gates: install, build, lint, typecheck, unit tests (`F-CORE-01`)

- **Where:** repository root, CLI (Node 22).
- **How:** `npm ci && npm run build && npm run lint && npm run format:check && npm run typecheck && npm test`
- **Expected:** every command exits 0. `npm test` reports `47 passed` (contracts), `97 passed` (api) and `215 passed` (web). `npm run build` emits `apps/web/dist/index.html`.

### Step 2 — Spec integrity (`F-CORE-01`)

- **Where:** repository root, CLI.
- **How:** `node .agents/skills/spec-architect/scripts/validate-specs.mjs --root . --json`
- **Expected:** the JSON contains `"valid": true` and an empty `errors` array.

### Step 3 — Layer boundaries are enforced from any directory (`F-CORE-02`, `F-BE-10`, `F-ECOMM-12`)

- **Where:** repository root and `apps/api`, CLI.
- **How:** run `printf 'import pg from "pg";\nexport const x = pg;\n' > apps/api/src/domain/zz-fixture.ts`. Then run `npm run lint` from the root, and `npx eslint --config ../../eslint.config.js src/domain/zz-fixture.ts` from `apps/api`. Then run `rm apps/api/src/domain/zz-fixture.ts`. The automated equivalent is `npx vitest run test/unit/shared/layer-boundaries.test.ts` in `apps/api`.
- **Expected:** both lint runs exit 1 with `no-restricted-imports … domain/ must not import pg`. The vitest file reports `6 passed`.

### Step 4 — Integration tests on PostgreSQL 16 (`F-DB-01`, `F-DB-02`, `F-ICOMM-02`, `F-CORE-05`, `F-ECOMM-01`)

- **Where:** a disposable PostgreSQL 16 database. The tests wipe it.
- **How:** `docker run -d --rm --name w00-it -p 55432:5432 -e POSTGRES_PASSWORD=test postgres:16-alpine`, wait about 3 s, then `TEST_DATABASE_URL=postgres://postgres:test@127.0.0.1:55432/postgres npm run test:integration`, then `docker stop w00-it`.
- **Expected:** `Test Files 6 passed`, `Tests 41 passed`. They cover:
  - Every table, column, constraint and index from persistence/01–02 (`schema.test.ts`).
  - Migrations apply on an empty DB, re-running is a no-op, and an edited applied file aborts startup.
  - A rolled-back unit of work publishes no events.
  - The error envelope for 400/401/404/500, with the `X-Request-Id` echo.
  - A revoked or expired session token returns `401 UNAUTHENTICATED`.

### Step 5 — Render the isolated wave compose bundle (`F-INFRA-04`)

- **Where:** repository root, CLI.
- **How:** `node .yardos/skills/wave-compose-deploy/scripts/compose-wave.mjs --root . --project insta --wave w00 --slot-index 0 --render-only --json`
- **Expected:**
  - `compose_project: "yd-insta-w00"` and `port_base: 21000`.
  - `ports` lists `web` at 21000→8080 and `api` at 21001→3000.
  - In `.yardos/waves/w00/compose.wave.yml`, `db` has no `ports:`.
  - `.env.wave` has `PUBLIC_URL=http://w00--insta.apps.localhost:9080` and `PUBLIC_API_URL=http://api--w00--insta.apps.localhost:9080`.

### Step 6 — Start the w00 stack and wait for health (`F-INFRA-01`, `F-INFRA-02`, `F-INFRA-03`, `F-INFRA-05`)

- **Where:** a Docker host, at the repository root.
- **How:** first create a direct-port override, `.yardos/waves/w00/compose.local.yml`, with this content:
  `services: { api: { environment: { PUBLIC_URL: "http://localhost:21000", PUBLIC_API_URL: "http://localhost:21001", CORS_ORIGIN: "http://localhost:21000" } }, web: { environment: { PUBLIC_URL: "http://localhost:21000", PUBLIC_API_URL: "http://localhost:21001" } } }`
  Then run:
  `export POSTGRES_PASSWORD=$(openssl rand -hex 16) && docker compose --project-directory . -p yd-insta-w00 -f .yardos/waves/w00/compose.base.yml -f .yardos/waves/w00/compose.wave.yml -f .yardos/waves/w00/compose.local.yml --env-file .yardos/waves/w00/.env.wave up -d --build --wait`
  Skip the override when testing through the Hoster proxy.
- **Expected:** the command exits 0 with `db`, `api` and `web` all `Healthy`. `docker image ls` shows the api image under 250 MB. `docker compose -p yd-insta-w00 ps` lists no host port for `db`.

### Step 7 — Health probes (`F-INFRA-07`, `F-ECOMM-01`)

- **Where:** `http://localhost:21001` (api) and `http://localhost:21000` (web).
- **How:** `curl -i http://localhost:21001/api/v1/health`, `curl -i http://localhost:21001/healthz` and `curl -i http://localhost:21000/healthz`.
- **Expected:**
  - `/api/v1/health` returns `200` with body `{"status":"ok","db":"ok","version":"…"}`, plus `Cache-Control: no-store` and an `X-Request-Id` header.
  - The api `/healthz` returns `200 {"status":"ok"}`.
  - The web `/healthz` returns `200` with body `ok`.

### Step 8 — Uniform error envelope and request id (`F-CORE-05`, `F-ECOMM-01`)

- **Where:** `http://localhost:21001/api/v1/does-not-exist`.
- **How:** `curl -i -H 'X-Request-Id: w00-check-1' http://localhost:21001/api/v1/does-not-exist`
- **Expected:** `404`, a JSON body whose `error.code` is `"NOT_FOUND"` and `error.request_id` is `"w00-check-1"`, and the response header `X-Request-Id: w00-check-1`. No stack trace appears in the body.

### Step 9 — Web runtime config and CSP (`F-FE-12`, `F-INFRA-02`)

- **Where:** `http://localhost:21000/config.js` and `http://localhost:21000/`.
- **How:** `curl -i http://localhost:21000/config.js` and `curl -sI http://localhost:21000/`.
- **Expected:**
  - `config.js` returns `200` with `Cache-Control: no-store` and the body `window.__APP_CONFIG__ = { apiUrl: "http://localhost:21001", publicUrl: "http://localhost:21000" };`.
  - `/` returns a `Content-Security-Policy` containing `connect-src 'self' http://localhost:21001`.

### Step 10 — SPA shell, theming and protected routes (`F-FE-01`, `F-FE-11`)

- **Where:** `http://localhost:21000/` in a browser.
- **How:** open `/` signed out. Then open `/explore`, a public page inside the shell, and resize the window to 1280 px wide, then to 375 px wide (or use device emulation). Switch the OS colour scheme between light and dark.
- **Expected:**
  - `/` redirects to `/login?next=%2F`, and the login placeholder renders.
  - At 1280 px the shell shows the desktop sidebar. At 375 px it shows the top and bottom bars.
  - The colours follow the OS scheme.
  - An unknown path such as `/nope/x/y` renders the Not Found page.
  - The console shows no errors.

### Step 11 — Second stack side-by-side (`F-INFRA-04`)

- **Where:** the same Docker host, while the w00 stack keeps running.
- **How:** `node .yardos/skills/wave-compose-deploy/scripts/compose-wave.mjs --root . --project insta --wave w01 --slot-index 1 --render-only`, then the step 6 `up` command with `w00`→`w01`, ports `21000/21001`→`21020/21021`, and project `yd-insta-w01`. Then run `curl -s http://localhost:21021/api/v1/health` and `docker volume ls | grep yd-insta-`.
- **Expected:** both stacks are healthy at the same time, with no "port is already allocated" errors. The volumes `yd-insta-w00_db-data`, `yd-insta-w00_media`, `yd-insta-w01_db-data` and `yd-insta-w01_media` are all distinct. Both health endpoints return `200`.

### Step 12 — Restart keeps migrations idempotent (`F-DB-02`)

- **Where:** the w00 stack.
- **How:** `docker compose -p yd-insta-w00 restart api && docker compose -p yd-insta-w00 logs api | tail -20`
- **Expected:** the api becomes healthy again. The logs show no migration being applied a second time, because `0001_init.sql` is already recorded. `GET /api/v1/health` returns `200`.

### Step 13 — Tear down

- **Where:** the Docker host.
- **How:** `docker compose -p yd-insta-w01 down -v && docker compose -p yd-insta-w00 down -v`
- **Expected:** both projects are removed, together with their networks and volumes. `docker ps -a --filter name=yd-insta-` is empty.

## Open Questions & Limitations

These items are mirrored in [`docs/questions-and-limitations/w00-gaps.md`](../../questions-and-limitations/w00-gaps.md).

**Gaps**

- [ ] **QL-w00-01** (`F-FE-12`, `frontend`): frontend/02 names the SSE client module `state/live.ts`, but the wave plan (W00-03) and the code use `apps/web/src/state/sse.ts`.
  - Suggested fix: Rename the spec section to `state/sse.ts` (code and wave plan agree); no code change.
- [ ] **QL-w00-02** (`F-FE-01`, `frontend`): The frontend spec does not say which `apps/web/src/api/*.ts` module hosts cross-resource calls; W00-03 put feed/explore/like in `api/posts.ts`, follow/unfollow in `api/users.ts` and hashtag posts in `api/search.ts`.
  - Suggested fix: Record this placement in frontend/01 or 02 so w02–w05 keep it.
- [ ] **QL-w00-03** (`F-CORE-03`, `backend`): `StoryServiceDeps` adds `storage: MediaStorage` (delete the file after `deleteStory` commits) and `users: UserRepository` (resolve `username` in `getUserStories`); neither is in the backend/02 port list.
  - Suggested fix: Add both ports to backend/02 `StoryService` before w04 relies on them.
- [ ] **QL-w00-04** (`F-ICOMM-01`, `internal-communication`): Search `limit` defaults to `LIMITS.searchLimitDefault` = 10 in `packages/contracts/src/dto/search.ts`; the spec states a max but no default.
  - Suggested fix: Confirm 10 and add it to external-communication/06 and internal-communication/01.
- [ ] **QL-w00-05** (`F-INFRA-04`, `infra`): infra/01 defines the wave port block as `18000 + NN*10` (10 ports) rendered to `.env.wave-<wNN>`, while the wave-compose-deploy skill and the wave plan use `21000 + slot*20` (20 ports) in `.yardos/waves/<wNN>/.env.wave`.
  - Suggested fix: Update infra/01 + infra/02 to the skill's scheme (21000 + slot*20, `.yardos/waves/<wNN>/`); keep 18000/18001 as plain-compose defaults.

**Issues & Limitations**

- [ ] **QL-w00-06** (`F-INFRA-01`, `infra`): Docker is not available in the validation sandbox, so image builds, the API image size cap (< 250 MB), the nginx config, `docker compose up --wait` health and the two-stack side-by-side run (F-INFRA-03/04) were NOT executed; only the compose render and a static isolation diff (slot 0 vs slot 1) were checked.
  - Suggested fix: Owner runs check-guide steps 6–12 on a Docker host before landing.
- [ ] **QL-w00-07** (`F-INFRA-05`, `infra`): The wave-compose-deploy bundle `.env.wave` has no `POSTGRES_PASSWORD`, but compose requires `${POSTGRES_PASSWORD:?}`, so `compose-wave.mjs --up` fails unless the variable is exported in the calling shell (infra/02 expects a random per-wave value).
  - Suggested fix: Export `POSTGRES_PASSWORD=$(openssl rand -hex 16)` before `--up` (see check guide step 6); longer-term the skill should generate it.
- [ ] **QL-w00-08** (`F-INFRA-04`, `infra`): The wave overlay hard-codes `PUBLIC_URL`/`PUBLIC_API_URL`/`CORS_ORIGIN` to `*.apps.localhost:9080` proxy URLs, which only work behind the Hoster proxy; browsing `http://localhost:21000` directly gives an SPA whose `apiUrl` points at the proxy, and `compose-wave.mjs --up` does not pass `--wait`.
  - Suggested fix: For direct-port checks use the `compose.local.yml` override from check-guide step 6.
- [x] **QL-w00-09** (`F-INFRA-04`, `infra`): wave-compose-deploy assigns port offsets in compose declaration order; with `api` declared before `web` it mapped api→21000 and web→21001 and pointed `PUBLIC_URL`/`CORS_ORIGIN` at the API. Fixed in W00-05 by declaring `web` before `api` in `docker-compose.yml` (web 21000, api 21001).
- [x] **QL-w00-10** (`F-CORE-02`, `specs`): `import/no-restricted-paths` zones resolved against `process.cwd()`, so layer rules were silently off when ESLint ran from a workspace directory (IDE, `apps/api`). Fixed in W00-05 with `basePath: import.meta.dirname` in `eslint.config.js` plus `apps/api/test/unit/shared/layer-boundaries.test.ts` (6 lint-fixture tests).
- [ ] **QL-w00-11** (`F-DB-01`, `persistence`): Integration tests (41/41) were run against PGlite 0.3 (WASM Postgres via `@electric-sql/pglite-socket`, with `pg_trgm`) and not PostgreSQL 16; the CI `compose-e2e`/integration job on `postgres:16-alpine` is the authoritative run.
  - Suggested fix: Run check-guide step 4 against `postgres:16-alpine`.
- [ ] **QL-w00-12** (`F-INFRA-06`, `infra`): No E2E specs exist yet (Playwright location `apps/web/e2e/` is decision P-4, delivered in w07); the CI e2e step tolerates "no specs".

**Open Questions**

- [ ] **QL-w00-13** (`F-INFRA-04`, `infra`): Which wave port scheme is canonical: infra/01 (`18000 + NN*10`) or the deploy skill (`21000 + slot*20`)?
  - Suggested fix: Proposed: the skill's scheme (see the related gap); owner to confirm.
