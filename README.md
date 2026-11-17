# insta-test

A self-hosted, Instagram-like photo & video sharing web app with a modern, minimal UI:
feed, photo/video posts, user profiles, follows, likes, comments, search, 24-hour stories, and live notifications.

> **Status:** Step 1 — specifications. The full design is in [`docs/specs/`](./docs/specs/README.md).
> Application code is built in waves that follow those specs. The layout and commands below describe the
> target state; until a wave adds a package, only the spec commands work.

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

## Quick Start (target state)

```sh
cp .env.example .env          # set POSTGRES_PASSWORD
docker compose up -d --build --wait
open http://localhost:18000   # web; API at http://localhost:18001/api/v1
```

Local development with hot reload (target state):

```sh
npm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm run dev                   # API (tsx watch) + web (Vite on :5173)
```

## Commands

| Command | Works now? | Purpose |
|---|---|---|
| `npm run validate:specs` | yes | Validate the spec tree (`valid: true` expected) |
| `npm run build` / `lint` / `typecheck` / `test` | after wave 1 | Build and check all workspaces |
| `npm run test:integration` | after wave 1 | API integration tests against Postgres |
| `npm run e2e` | after the web wave | Playwright smoke test |

## Contributing (humans and agents)

Read [AGENTS.md](./AGENTS.md) first. **Spec-first:** check `docs/specs/` before changing code, update the specs before changing a contract,
and record open questions in `docs/questions-and-limitations/`.
