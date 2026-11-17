---
name: spec-architect
description: "Author or update a scalable 7-category markdown specification superset, cross-layer DTO/Business/DB entity mappings, AGENTS.md, CLAUDE.md, and repo-local wave skills before any application code is written."
---

# Spec-First Architect (7-Category Superset)

## Purpose

Turn a product or feature description plus owner Q&A answers into a complete, scalable, machine-verifiable `.md` specification tree under `docs/specs/` so every coding agent checks the specs first and implements against explicit contracts.

## Mandatory 7 Specification Categories

Every target repository MUST have `docs/specs/README.md` plus all **7 category directories** (never omit a directory; if a category genuinely does not apply, write `Status: Not Applicable — <one-line rationale>` in its `README.md`):

1. `docs/specs/specs/` — **Core System Specs**
   - `README.md` — index of core specs.
   - `01-project-structure.md` — exact directory layout, module boundaries, ownership prefixes (`owned_paths`), and auto-discovery extension points.
   - `02-architecture-and-patterns.md` — architectural style (clean/hexagonal layers, thin orchestrators, DI/ports & adapters, error handling, validation boundaries, testing pyramid).
   - `03-domain-and-entity-map.md` — **Master Cross-Layer Entity Catalog**: every `ENT-<Name>` mapped field-by-field across API Request/Response DTOs, Application Business Entities, and Database Entities.
   - `04-decisions-and-invariants.md` — `DEC-01..NN` architectural decisions, invariants, and glossary.
2. `docs/specs/frontend/` — UI shell, routing, state management, design tokens, accessibility, ViewModels, and `API DTO <-> ViewModel` mappers.
3. `docs/specs/backend/` — Application Business Entities, domain invariants, use-case services, thin HTTP/RPC handlers, and repository/adapter port interfaces.
4. `docs/specs/persistence/` — Database Entities, tables, columns, types, PK/FK/CHECK constraints, indexes, migrations strategy, and `Database Entity <-> Business Entity` mappers.
5. `docs/specs/internal-communication/` — Monorepo shared contracts, internal RPC/events, queues/streams, WebSocket/SSE protocols, and idempotency rules.
6. `docs/specs/external-communication/` — Public REST/GraphQL/webhook API contracts, Request/Response DTO schemas, status/error codes, auth, `DTO <-> Business Entity` mappers, and third-party integrations.
7. `docs/specs/infra/` — Dockerfiles, `docker-compose.yml`, isolated per-wave compose port blocks (`WAVE_PORT_BASE`), environment variables, secrets, CI gates, and health probes.

## Execution Protocol

1. **Scout First:** Read existing `docs/specs/**`, `AGENTS.md`, `CLAUDE.md`, package manifests, and migrations. Extend and refine existing specs; never blindly wipe established `DEC-*` or `F-*` IDs.
2. **Bootstrap Skeleton:** Run:
   ```sh
   node .yardos/skills/spec-architect/scripts/scaffold-specs.mjs --root .
   ```
   to ensure all 7 category folders, `docs/questions-and-limitations/README.md`, `docs/questions-and-limitations/GAPS_AND_QUESTIONS.md`, and `.agents/skills/` exist.
3. **Author Detailed Category Specs:**
   - Assign stable feature IDs (`F-CORE-01`, `F-FE-01`, `F-BE-01`, `F-DB-01`, `F-ICOMM-01`, `F-ECOMM-01`, `F-INFRA-01`) with explicit acceptance criteria.
   - Follow `refs/entity-mapping-guide.md` so every `ENT-<Name>` defines its API Req/Res DTOs, Business Entity, Database Entity, and bidirectional field mapping table.
   - Keep individual `.md` files modular and focused (split large domains into numbered files `01-...md`, `02-...md` linked from the category `README.md`).
4. **Author `AGENTS.md` and `CLAUDE.md`:**
   - Follow `refs/agents-claude-templates.md`.
   - Include the **Mandatory Spec-First Rule** ("Agents MUST inspect `docs/specs/` before writing or modifying code; if code and spec diverge, update the spec first or record a question in `docs/questions-and-limitations/`"), the **7-Category Spec Routing Table**, and the **Wave Skill Routing Table** pointing at `.agents/skills/`.
5. **Validate Before Finishing:**
   ```sh
   node .yardos/skills/spec-architect/scripts/validate-specs.mjs --root . --json
   ```
   Fix every reported validation error until `"valid": true` with zero `validation_errors`. Do NOT write application feature implementation code in Step 1.
