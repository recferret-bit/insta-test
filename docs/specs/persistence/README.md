# Persistence Specifications

- **Status:** Active

PostgreSQL 16 is the single source of truth for all structured data; media bytes live on the `media` volume (`MEDIA_DIR`).

| File | Content |
|---|---|
| [01-schema.md](./01-schema.md) | Tables, columns, types, PK/FK/CHECK constraints (Database Entities) |
| [02-migrations-and-indexes.md](./02-migrations-and-indexes.md) | Forward-only migration runner, initial migration plan, index catalog per query path |
| [03-row-mappers.md](./03-row-mappers.md) | `<Name>Row` types and `Row ↔ Business Entity` mapper contracts |

## Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| `F-DB-01` | Schema v1 | Migration `0001_init.sql` creates every table in [01-schema.md](./01-schema.md) with listed constraints; `\d+` output matches spec in an integration test (information_schema check). |
| `F-DB-02` | Forward-only migrations | Runner applies pending `NNNN_*.sql` in order inside a tx each, records checksum in `schema_migrations`, refuses to start if an applied file's checksum changed; there is no down-migration path. |
| `F-DB-03` | Index coverage | Every query in [02-migrations-and-indexes.md](./02-migrations-and-indexes.md#index-catalog) uses its listed index (`EXPLAIN` test on seeded data for feed, profile grid, comments, notifications, search). |
| `F-DB-04` | Row mappers | `mapXRowToEntity` / `mapXEntityToRow` exist for every table and round-trip in unit tests. |
| `F-DB-05` | Counter integrity | Integration test recomputes counters from source rows after a randomized sequence of actions and asserts equality (`INV-05`). |
