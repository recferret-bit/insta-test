# AGENTS.md — Spec-First Engineering Constitution

Project: **insta-test** — a self-hosted, Instagram-like photo/video sharing app (feed, posts, profiles, follows, likes, comments, search, stories, live notifications).
Stack: TypeScript monorepo — `apps/api` (Fastify + PostgreSQL), `apps/web` (React + Vite), `packages/contracts` (Zod DTOs), Docker Compose.

## 1. Mandatory Spec-First Protocol (READ BEFORE WRITING CODE)

1. **Check Specs First:** Before creating, editing, or refactoring any code, read [docs/specs/README.md](./docs/specs/README.md) and the relevant category specifications below. Agents MUST inspect `docs/specs/` before writing or modifying code.
2. **Spec Is Source of Truth:** Never invent undocumented endpoints, database columns, events, error codes, or entity fields. If an implementation requires a contract change, update `docs/specs/**` FIRST in the same change or in the wave's contract pre-step (`WNN-01`). If code and spec diverge, update the spec first or record a question in `docs/questions-and-limitations/`.
3. **Three-Layer Entity Mapping:** Keep API Req/Res DTOs (`packages/contracts`, `docs/specs/external-communication/`), Application Business Entities (`apps/api/src/domain`, `docs/specs/backend/`), and Database Entities (`apps/api/src/data/rows`, `docs/specs/persistence/`) distinct, with the explicit mapper functions listed in [docs/specs/specs/03-domain-and-entity-map.md](./docs/specs/specs/03-domain-and-entity-map.md). Never return DB rows from HTTP handlers; never pass request bodies to repositories.
4. **Layer Rule:** `api → domain ← data`. `domain/` must not import Fastify, `pg`, `@insta/contracts`, `api/`, or `data/` ([02-architecture-and-patterns.md](./docs/specs/specs/02-architecture-and-patterns.md)).
5. **Owned-Paths Discipline:** During wave execution, modify ONLY files inside your task's `owned_paths` (prefixes in [01-project-structure.md](./docs/specs/specs/01-project-structure.md#ownership-prefixes-owned_paths)).
6. **Questions & Limitations Ledger:** Whenever you hit a spec gap, issue/limitation, or open question during wave `wNN`, save it in `docs/questions-and-limitations/<wNN>-gaps.md` (compiled into [GAPS_AND_QUESTIONS.md](./docs/questions-and-limitations/GAPS_AND_QUESTIONS.md) on wave landing for owner review & fix). Do not silently guess.
7. **Stable IDs:** Never renumber or delete existing `F-*`, `ENT-*`, `DEC-*`, `INV-*`, `Q-*` IDs; append new ones.
8. **Validate Specs:** After touching `docs/specs/**`, run `node .agents/skills/spec-architect/scripts/validate-specs.mjs --root . --json` and fix until `"valid": true`.

## 2. Specification Routing Table (`docs/specs/`)

| Category | Path | Consult When Working On |
|---|---|---|
| Core & Entities | `docs/specs/specs/` | Project structure, architecture patterns, master DTO<->Business<->DB entity map, `DEC-*`, invariants |
| Frontend | `docs/specs/frontend/` | Pages, routes, components, client state, ViewModels, design tokens, SSE client |
| Backend | `docs/specs/backend/` | Business entities, services/use cases, ports, handlers, scheduled jobs |
| Persistence | `docs/specs/persistence/` | PostgreSQL schema, migrations, indexes, Row<->Business mappers |
| Internal Comm | `docs/specs/internal-communication/` | `@insta/contracts`, in-process domain events, SSE protocol |
| External Comm | `docs/specs/external-communication/` | Public REST `/api/v1` endpoints, Req/Res DTOs, error codes, auth, media serving; third-party integrations (none) |
| Infra | `docs/specs/infra/` | Dockerfiles, compose, wave port isolation (`WAVE_PORT_BASE`), env vars, CI, probes |

## 3. Wave & Spec Skills (`.agents/skills/`)

| Skill | Path | Purpose |
|---|---|---|
| `spec-architect` | `.agents/skills/spec-architect/SKILL.md` | Author/update the 7-category specs & entity maps (installed) |
| `wave-planner` | `.agents/skills/wave-planner/SKILL.md` | Plan parallel waves (`docs/plan/PRODUCT_WAVES.md` + `WAVE_MANIFEST.json`) |
| `spec-first-worker` | `.agents/skills/spec-first-worker/SKILL.md` | Implement wave tasks strictly from specs within `owned_paths` |
| `wave-validate` | `.agents/skills/wave-validate/SKILL.md` | 2-iteration pre-landing validation & `wNN-check.md` review guide |
| `wave-land` | `.agents/skills/wave-land/SKILL.md` | Careful 3-iteration merge of approved wave into `main` |
| `wave-sync` | `.agents/skills/wave-sync/SKILL.md` | Careful 3-iteration sync of refreshed `main` into WIP waves |
| `wave-compose-deploy` | `.agents/skills/wave-compose-deploy/SKILL.md` | Deploy wave on isolated `docker-compose` copy & unique ports |

Skills other than `spec-architect` are provisioned into `.agents/skills/` by the orchestrator when the corresponding phase starts; if a skill folder is missing, follow the protocol above and record the gap.

## 4. Engineering Conventions (summary)

- TypeScript strict, ESM, Node 22. Wire JSON `snake_case`; TS `camelCase`; SQL `snake_case`.
- Public IDs `<prefix>_<32 hex>` on the wire, `uuid` in DB (`DEC-04`).
- Errors: `DomainError(code)` → central handler → `ErrorResponseDto`.
- Migrations: forward-only `apps/api/migrations/NNNN_name.sql`; never edit an applied file.
- Tests: unit for domain & mappers, integration for every endpoint against real Postgres.
- Never commit secrets; `.env` is gitignored.
