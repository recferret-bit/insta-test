# Root `AGENTS.md` & `CLAUDE.md` Templates

## `AGENTS.md` Required Sections

```markdown
# AGENTS.md — Spec-First Engineering Constitution

## 1. Mandatory Spec-First Protocol (READ BEFORE WRITING CODE)

1. **Check Specs First:** Before creating, editing, or refactoring any code, read `docs/specs/README.md` and the relevant category specifications below.
2. **Spec Is Source of Truth:** Never invent undocumented endpoints, database columns, events, or entity fields. If an implementation requires a contract change, update `docs/specs/**` FIRST in the same change or contract pre-step (`WNN-01`).
3. **Three-Layer Entity Mapping:** Keep API Req/Res DTOs, Application Business Entities, and Database Entities distinct with explicit mapper functions (`docs/specs/specs/03-domain-and-entity-map.md`).
4. **Owned-Paths Discipline:** During wave execution, modify ONLY files inside your task's `owned_paths`.
5. **Questions & Limitations Ledger:** Whenever you hit a spec gap, issue/limitation, or open question during wave `wNN`, save it in `docs/questions-and-limitations/<wNN>-gaps.md` (compiled into `docs/questions-and-limitations/GAPS_AND_QUESTIONS.md` on wave landing for owner review & fix).

## 2. Specification Routing Table (`docs/specs/`)

| Category | Path | Consult When Working On |
|---|---|---|
| Core & Entities | `docs/specs/specs/` | Project structure, architecture patterns, master DTO<->Business<->DB entity map, `DEC-*` |
| Frontend | `docs/specs/frontend/` | Pages, components, client state, ViewModels, UI styling |
| Backend | `docs/specs/backend/` | Domain entities, business services, orchestrators, ports |
| Persistence | `docs/specs/persistence/` | SQL/ORM schemas, migrations, indexes, DB<->Business mappers |
| Internal Comm | `docs/specs/internal-communication/` | Shared packages, internal events/queues, RPC, WS/SSE |
| External Comm | `docs/specs/external-communication/` | Public HTTP/GraphQL APIs, Req/Res DTOs, webhooks, 3rd-party SDKs |
| Infra | `docs/specs/infra/` | Docker, compose, wave port isolation, env vars, CI, probes |

## 3. Wave & Spec Skills (`.agents/skills/`)

| Skill | Path | Purpose |
|---|---|---|
| `spec-architect` | `.agents/skills/spec-architect/SKILL.md` | Author/update the 7-category specs & entity maps |
| `wave-planner` | `.agents/skills/wave-planner/SKILL.md` | Plan parallel waves (`docs/plan/PRODUCT_WAVES.md` + `WAVE_MANIFEST.json`) |
| `spec-first-worker` | `.agents/skills/spec-first-worker/SKILL.md` | Implement wave tasks strictly from specs within `owned_paths` |
| `wave-validate` | `.agents/skills/wave-validate/SKILL.md` | 2-iteration pre-landing validation & `wNN-check.md` review guide |
| `wave-land` | `.agents/skills/wave-land/SKILL.md` | Careful 3-iteration merge of approved wave into `main` |
| `wave-sync` | `.agents/skills/wave-sync/SKILL.md` | Careful 3-iteration sync of refreshed `main` into WIP waves |
| `wave-compose-deploy` | `.agents/skills/wave-compose-deploy/SKILL.md` | Deploy wave on isolated `docker-compose` copy & unique ports |
```

## `CLAUDE.md` Required Sections

`CLAUDE.md` MUST point Claude Code immediately to `@AGENTS.md` and `docs/specs/README.md`, repeat the Spec-First rule ("Always read the relevant files in `docs/specs/` BEFORE editing code"), and list slash/natural-language triggers for `wave-validate`, `wave-land`, `wave-sync`, and `wave-compose-deploy`.
