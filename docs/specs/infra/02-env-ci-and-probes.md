# 02 — Environment, Secrets, CI & Health Probes

Features: `F-INFRA-05` … `F-INFRA-07`.

## Environment Variable Catalog

| Variable | Used by | Required | Default | Description |
|---|---|---|---|---|
| `COMPOSE_PROJECT_NAME` | compose | no | `insta` | Namespace for per-wave isolation |
| `WAVE_PORT_BASE` | deploy skill | no | `18000` | First host port of the wave block |
| `WEB_HOST_PORT` | compose | no | `18000` | Host port for `web` |
| `API_HOST_PORT` | compose | no | `18001` | Host port for `api` |
| `DB_HOST_PORT` | compose dev override | no | `18002` | Host port for `db` (dev only) |
| `PUBLIC_URL` | web, api | yes | — | Public origin of the SPA, e.g. `http://localhost:18000` |
| `PUBLIC_API_URL` | web, api | yes | — | Public origin of the API (used to build media URLs and by the SPA) |
| `CORS_ORIGIN` | api | yes | — | Comma-separated allowed origins (normally = `PUBLIC_URL`) |
| `POSTGRES_DB` | db, api | no | `insta` | — |
| `POSTGRES_USER` | db, api | no | `insta` | — |
| `POSTGRES_PASSWORD` | db, api | **secret** | — | Never committed; `.env.example` holds a placeholder |
| `DATABASE_URL` | api | yes (outside compose) | built by compose | `postgres://user:pass@host:5432/db` |
| `API_PORT` | api | no | `3000` | Listen port inside container |
| `MEDIA_DIR` | api | no | `/data/media` | Media volume root |
| `MIGRATE_ON_START` | api | no | `true` | Run migrations at boot |
| `JOBS_ENABLED` | api | no | `true` | Run cleanup jobs |
| `SESSION_TTL_DAYS` | api | no | `30` | Session lifetime |
| `LOG_LEVEL` | api | no | `info` | pino level |
| `RESPONSE_VALIDATION` | api | no | `off` (`strict` in test) | Validate responses against contracts |
| `GIT_SHA` | api | no | `dev` | Reported by `/api/v1/health` |

`config/env.ts` parses these with Zod (`url()` for URLs, `coerce.number()` for ports) and exits with a readable error listing all invalid keys.

## Secrets

- Only `POSTGRES_PASSWORD` is secret in v1. Provided via `.env` (gitignored) locally and per-wave generated random value in previews; GitHub Actions uses an ephemeral value per job.
- `.env`, `.env.*` (except `.env.example`) are in `.gitignore`.
- Logs redact `authorization`, `password`, `access_token`, `ticket`.

## Health Probes

| Probe | Service | Endpoint | Checks | Used by |
|---|---|---|---|---|
| Liveness | api | `GET /healthz` | Event loop responsive | Orchestrators (future) |
| Readiness | api | `GET /api/v1/health` | `SELECT 1` within 1 s and latest migration applied | Compose healthcheck |
| Liveness/readiness | web | `GET /healthz` | nginx serving | Compose healthcheck |
| Readiness | db | `pg_isready` | Postgres accepting connections | Compose healthcheck |

API graceful shutdown: on `SIGTERM` stop accepting connections, close SSE streams, wait up to 10 s for in-flight requests, stop jobs, end the pool.

## Root npm Scripts (planned `package.json`)

| Script | Action |
|---|---|
| `validate:specs` | `node .agents/skills/spec-architect/scripts/validate-specs.mjs --root .` |
| `build` | `npm run build --workspaces --if-present` |
| `lint` | `eslint .` |
| `typecheck` | `tsc -b` |
| `test` | `npm run test --workspaces --if-present` (unit) |
| `test:integration` | `npm run test:integration -w apps/api` (needs `DATABASE_URL`) |
| `dev` | API (`tsx watch`) + web (Vite) concurrently |
| `e2e` | Playwright against `PUBLIC_URL` |

## CI Gates (`.github/workflows/ci.yml`)

Runs on every PR and push to `main`:

1. `npm ci`
2. `npm run validate:specs` — spec tree must be `valid: true`
3. `npm run lint` + `npm run typecheck`
4. `npm test` — unit (domain, mappers, web mappers)
5. Integration — job with `postgres:16-alpine` service; `npm run test:integration`
6. `npm run build`
7. Compose smoke — `docker compose up -d --build --wait` with ephemeral `.env`, then `curl -f $PUBLIC_API_URL/api/v1/health` and `curl -f $PUBLIC_URL/healthz`
8. `npm run e2e` (Playwright happy path + Lighthouse a11y on 3 pages)
9. Grep gate — no outbound HTTP in `apps/api/src` (`F-ECOMM-12`)

All steps are required checks for merging.
