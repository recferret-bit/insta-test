# CLAUDE.md

Read and follow @AGENTS.md and [docs/specs/README.md](./docs/specs/README.md) before modifying any code.

## Spec-First Rule

- **Always read the relevant files in `docs/specs/` BEFORE editing code:** `docs/specs/{specs,frontend,backend,persistence,internal-communication,external-communication,infra}/`.
- Update specs before changing contracts (endpoints, DTOs, entities, tables, events, env vars). If code and spec diverge, fix the spec first or record a question.
- Keep DTO ↔ Business Entity ↔ DB Row separate with the mappers named in `docs/specs/specs/03-domain-and-entity-map.md`.
- Record gaps/issues/questions found during wave `wNN` in `docs/questions-and-limitations/<wNN>-gaps.md`.
- Edit only files within your task's `owned_paths`.
- After touching specs: `node .agents/skills/spec-architect/scripts/validate-specs.mjs --root . --json` must report `"valid": true`.

## Wave Skills (`.agents/skills/`)

| Trigger (slash / natural language) | Skill | Command |
|---|---|---|
| `/spec-architect`, "update the specs" | `spec-architect` | `node .agents/skills/spec-architect/scripts/validate-specs.mjs --root . --json` |
| `/wave-validate`, "validate wave wNN" | `wave-validate` | `node .agents/skills/wave-validate/scripts/validate-wave.mjs --root . --wave <wNN>` |
| `/wave-land`, "land wave wNN into main" | `wave-land` | `node .agents/skills/wave-land/scripts/wave-land.mjs --repo . --wave <wNN>` |
| `/wave-sync`, "sync main into wave wNN" | `wave-sync` | `node .agents/skills/wave-sync/scripts/wave-sync.mjs --repo . --wave <wNN> --sync-issues` |
| `/wave-compose-deploy`, "deploy wave wNN preview" | `wave-compose-deploy` | `node .agents/skills/wave-compose-deploy/scripts/compose-wave.mjs --root . --project insta --wave <wNN> --render-only` |
