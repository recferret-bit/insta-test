# Backend contracts (W01-01)

Frozen contracts for the three entity layers plus the SQL schema. The spec layout puts these elsewhere. This task's
`owned_paths` are `src/backend/contracts/**` and `db/migrations/**`, so they live here until a task that owns the target
paths moves them (recorded as a w01 gap).

| Folder here | Layer | Target home per `docs/specs/specs/01-project-structure.md` | May import |
|---|---|---|---|
| `wire/` | API Req/Res DTOs (Zod) | `packages/contracts/src/` (`@insta/contracts`) | `zod` only |
| `domain/` | Business entities, read models, commands, `DomainError`, domain events | `apps/api/src/domain/**` | nothing outside `domain/` (no zod, pg, fastify, wire) |
| `rows/` | DB row types (`*Row`) + column catalog | `apps/api/src/data/rows/` | nothing |
| `../../../db/migrations/0001_init.sql` | Schema v1 | `apps/api/migrations/0001_init.sql` | — |

The mappers named in `docs/specs/specs/03-domain-and-entity-map.md` are the next tasks' job. Each layer keeps its own
copies of shared constants (error codes, ID prefixes, limits), and `test/parity.test.ts` checks they stay equal.

Zod-free wire modules (`limits.ts`, `error-codes.ts`, `id-prefixes.ts`) are split out so the parity tests run without
dependencies. `errors.ts` and `ids.ts` re-export them next to the Zod schemas.

## Checks

```sh
cd src/backend/contracts
npm install          # zod, typescript, @types/node
npm test             # node --test (Node ≥ 22.18 strips TS types natively)
npm run typecheck    # also asserts row types == TABLE_COLUMNS at compile time
```

`test/dto.test.ts` skips itself when `zod` is not installed. `test/schema.test.ts` checks the SQL statically:
columns against the row types, FK order, `ON DELETE` rules, the index catalog, and CHECK limits against domain limits.
Applying the schema to a real PostgreSQL 16 and checking `information_schema` is left to the API integration suite.
