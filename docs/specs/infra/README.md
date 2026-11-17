# Infra Specifications

- **Status:** Active

Docker Compose stack with health-checked `web` and `api` entry services and an internal `db`, configured via `PUBLIC_URL`, `PUBLIC_API_URL`, and `CORS_ORIGIN`, with host ports derived from `WAVE_PORT_BASE` for isolated per-wave previews (`DEC-07`).

| File | Content |
|---|---|
| [01-docker-compose.md](./01-docker-compose.md) | Dockerfiles, compose services, volumes, networks, health checks, per-wave port blocks |
| [02-env-ci-and-probes.md](./02-env-ci-and-probes.md) | Environment variable catalog, secrets, CI gates, health probes, local dev workflow |

## Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| `F-INFRA-01` | API image | Multi-stage `apps/api/Dockerfile` builds a non-root Node 22 image < 250 MB that runs migrations then serves on `API_PORT` (default 3000). |
| `F-INFRA-02` | Web image | Multi-stage `apps/web/Dockerfile` builds the SPA and serves it from `nginx:alpine` with SPA fallback, runtime `/config.js`, and `/healthz`. |
| `F-INFRA-03` | Compose stack | `docker compose up -d --wait` brings `db`, `api`, `web` to healthy; only `web` and `api` publish host ports; `db` is internal. |
| `F-INFRA-04` | Per-wave isolation | Two stacks with different `COMPOSE_PROJECT_NAME`/`WAVE_PORT_BASE` run side-by-side without port, volume, or network collisions. |
| `F-INFRA-05` | Env configuration | Every variable in [02-env-ci-and-probes.md](./02-env-ci-and-probes.md) is documented in `.env.example`; API exits non-zero on invalid config. |
| `F-INFRA-06` | CI gates | GitHub Actions workflow runs spec validation, lint, typecheck, unit, integration (Postgres service), build, compose smoke + Playwright e2e on every PR. |
| `F-INFRA-07` | Health probes | `GET /healthz` (web & api liveness) and `GET /api/v1/health` (api readiness incl. DB) back the compose healthchecks. |
