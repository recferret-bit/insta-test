# Core System Specs

- **Status:** Active

| File | Content |
|---|---|
| [01-project-structure.md](./01-project-structure.md) | Monorepo layout, layered module boundaries, `owned_paths` prefixes, extension points |
| [02-architecture-and-patterns.md](./02-architecture-and-patterns.md) | Layering (api → domain ← data), DI/ports, validation, errors, transactions, testing pyramid |
| [03-domain-and-entity-map.md](./03-domain-and-entity-map.md) | Master cross-layer entity catalog (`ENT-*`): DTO ↔ Business Entity ↔ Database Entity |
| [04-decisions-and-invariants.md](./04-decisions-and-invariants.md) | `DEC-01..NN` decisions, global invariants, glossary |

## Core Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| `F-CORE-01` | Layered monorepo skeleton | Directory tree matches [01-project-structure.md](./01-project-structure.md); `npm run build` and `npm test` succeed from repo root for all workspaces. |
| `F-CORE-02` | Strict layer dependency rule | `domain/` imports nothing from `api/`, `data/`, Fastify, or `pg`; enforced by an ESLint `import/no-restricted-paths` rule that fails CI. |
| `F-CORE-03` | Three-layer entity mapping | Every `ENT-*` has DTO, Business Entity, and Row types with named mapper functions listed in [03-domain-and-entity-map.md](./03-domain-and-entity-map.md); each mapper has a round-trip unit test. |
| `F-CORE-04` | Public prefixed IDs | All IDs on the wire use the `<prefix>_<32 hex>` form (`DEC-04`); raw UUIDs never appear in responses. |
| `F-CORE-05` | Uniform error model | Every non-2xx response uses the `ErrorResponseDto` envelope with a code from the error catalog in [external-communication/01-api-conventions.md](../external-communication/01-api-conventions.md). |
