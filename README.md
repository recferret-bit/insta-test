# insta-test

A self-hosted, Instagram-like photo & video sharing web app with a modern, minimal UI:
feed, photo/video posts, user profiles, follows, likes, comments, search, 24-hour stories, and live notifications.

> **Status:** Wave `w00` (foundation) — workspace, contracts, schema v1, API/web platform skeletons, Docker
> images, Compose stack and CI. Feature endpoints are stubs until their waves land. The full design is in
> [`docs/specs/`](./docs/specs/README.md).

## Architecture at a Glance

| Part | Tech | Path |
|---|---|---|
| Web SPA | React 18, Vite, React Router, TanStack Query | `apps/web` |
| REST API + SSE | Node 22, Fastify 5, Zod, `pg` | `apps/api` |
| Shared wire contracts | Zod schemas + TS types | `packages/contracts` |
| Database | PostgreSQL 16 (forward-only SQL migrations) | `apps/api/migrations` |
| Media storage | Local Docker volume served by the API | `MEDIA_DIR` |
| Packaging | Docker Compose: `web`, `api`, internal `db` | `docker-compose.yml` |

The API uses layers `api → domain ← data`, with separate DTO, business-entity and database-row types and explicit mappers between them.
See [docs/specs/specs/02-architecture-and-patterns.md](./docs/specs/specs/02-architecture-and-patterns.md).

## Repository Layout

```text
apps/api            REST API (/api/v1), SSE, migrations, jobs
apps/web            React SPA served by nginx
packages/contracts  Shared DTO / event schemas (@insta/contracts)
docs/specs          7-category specification (source of truth)
docs/questions-and-limitations  Gap & question ledger
.agents/skills      Agent skills (spec-architect, wave tooling)
```

## Prerequisites

- Node.js 22 LTS and npm 10+
- Docker with Compose v2

## Quick Start (Docker)

```sh
cp .env.example .env          # set POSTGRES_PASSWORD (e.g. openssl rand -hex 24)
docker compose up -d --build --wait
curl -f http://localhost:18001/api/v1/health   # API readiness (DB + migrations)
open http://localhost:18000                    # web SPA
docker compose down            # add -v to also drop the db-data and media volumes
```

The stack is `web` (nginx, host port `WEB_HOST_PORT`), `api` (host port `API_HOST_PORT`) and an internal `db`
(no host port). Data lives in the named volumes `db-data` and `media`, namespaced by `COMPOSE_PROJECT_NAME`.

### Side-by-side stacks (wave previews)

Each stack gets its own `COMPOSE_PROJECT_NAME` and a block of 10 host ports from `WAVE_PORT_BASE`
(`web` = base+0, `api` = base+1, dev-only `db` = base+2; wave `wNN` uses `18000 + NN*10`):

```sh
# .env.wave-w03: COMPOSE_PROJECT_NAME=insta-w03, WAVE_PORT_BASE=18030, WEB_HOST_PORT=18030, API_HOST_PORT=18031,
#                PUBLIC_URL=http://localhost:18030, PUBLIC_API_URL=http://localhost:18031, CORS_ORIGIN=http://localhost:18030,
#                POSTGRES_PASSWORD=<random>
docker compose --env-file .env.wave-w03 up -d --build --wait
docker compose -p insta-w03 down -v   # teardown
```

See [docs/specs/infra/01-docker-compose.md](./docs/specs/infra/01-docker-compose.md#per-wave-port-blocks-wave_port_base).

## Local Development

```sh
npm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db   # Postgres on DB_HOST_PORT (18002)
set -a; . ./.env; set +a      # the API reads process.env only; set MEDIA_DIR=./data/media for host dev
npm run dev                   # API (tsx watch, :API_PORT) + web (Vite on :5173)
```

`.env.example` documents every variable from [infra/02](./docs/specs/infra/02-env-ci-and-probes.md#environment-variable-catalog).

## Commands

| Command | Purpose |
|---|---|
| `npm run validate:specs` | Validate the spec tree (`valid: true` expected) |
| `npm run build` / `lint` / `typecheck` / `test` | Build and check all workspaces (unit tests) |
| `npm run test:integration` | API integration tests; needs `TEST_DATABASE_URL` or `DATABASE_URL` (the database is wiped) |
| `npm run e2e` | Playwright against `PUBLIC_URL` (specs arrive in wave `w07`) |

## CI

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every PR and push to `main`: `npm ci`, spec validation,
lint, typecheck, unit tests, integration tests (PostgreSQL 16 service), build, a Compose smoke test
(`docker compose up --wait` + health probes), Playwright e2e (passes with no specs until `w07`), and a grep gate that
forbids outbound HTTP in `apps/api/src` (`F-ECOMM-12`).

## Contributing (humans and agents)

Read [AGENTS.md](./AGENTS.md) first. **Spec-first:** check `docs/specs/` before changing code, update the specs before changing a contract,
and record open questions in `docs/questions-and-limitations/`.
