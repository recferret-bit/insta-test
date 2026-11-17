# W07 — Hardening, Integrity Tests & End-to-End Smoke

| Field | Value |
|---|---|
| Wave | `w07` (`hardening-e2e`) |
| Depends on | `w05`, `w06` (therefore all waves) |
| Branch | `wave/w07-hardening-e2e` from `main` (after w05 and w06 land) |
| Compose | `yd-insta-w07`, slot 7, ports 21140–21159 (web 21140, api 21141) |
| Migrations | `0002_hardening.sql` reserved — only for a confirmed index/constraint gap |
| Spec refs | `F-CORE-01..05`, `F-DB-03`, `F-DB-05`, `F-INFRA-06`, `F-FE-11`, `F-ECOMM-12` |

## Goal

Close the loop: fold resolved gaps from w00–w06 back into the specs, prove the cross-cutting invariants on the full
system (counter integrity, index coverage, architecture rules, contract coverage), and add the Playwright happy path
and accessibility gates to CI against the compose stack.

## Specs to Read First

`specs/02` (testing pyramid), `specs/04` (all `INV-*`), `persistence/02` (index catalog), `infra/02` (CI gates),
`frontend/03` (a11y), all `docs/questions-and-limitations/w0*-gaps.md`.

## Task DAG

```text
W07-01 (contracts) ──┬── W07-02 Integrity, index & architecture tests
                     └── W07-03 Playwright e2e & a11y CI gates
                                └──► W07-04 validate
```

### W07-01 — Spec reconciliation & final contract freeze (`contracts`)

- For every resolved item in `w00`…`w06` gap ledgers: update the matching `docs/specs/**` file (spec-first, stable IDs,
  append-only `F-*`/`DEC-*`/`Q-*`). Fix any remaining contract drift in `packages/contracts` (additive only).
- Add `0002_hardening.sql` only if a missing index/constraint is confirmed; otherwise do not create the file.
- `node .agents/skills/spec-architect/scripts/validate-specs.mjs --root . --json` → `"valid": true`.

### W07-02 — Integrity, index & architecture tests (`worker`)

- `test/integration/hardening/counters`: randomized sequence (seeded PRNG) of post create/delete, like/unlike,
  comment add/delete, follow/unfollow across 10 users; recompute every counter from source rows and assert equality (`INV-05`, `F-DB-05`).
- `test/integration/hardening/explain`: seeded data; `EXPLAIN` for feed, profile grid, comments, notifications, user and
  hashtag search uses the index named in the catalog (`F-DB-03`).
- `test/integration/hardening/contracts`: every registered route has at least one test that parses its response with
  `@insta/contracts` (route table vs. test registry).
- `test/unit/architecture`: domain import boundaries, `ErrorCode` parity, `LIMITS` parity, no outbound HTTP in
  `apps/api/src` (`F-ECOMM-12`), no raw UUID in sampled responses (`F-CORE-04`).

### W07-03 — Playwright e2e & a11y gates (`worker`)

- `apps/web/playwright.config.ts` + `apps/web/e2e/`: sign up A → upload → post → sign up B → follow A → like → comment →
  A creates a story → B views it → A sees notifications. Runs against `PUBLIC_URL` of a compose stack.
- Lighthouse (or axe) accessibility ≥ 90 on home, profile and post pages; keyboard-only story viewer check (`F-FE-11`).
- Extend `.github/workflows/ci.yml`: compose smoke + e2e + a11y as required jobs (`F-INFRA-06`).

### W07-04 — Validate (`validate`)

2-iteration `wave-validate` running the whole CI gate list locally; compose preview on slot 7 with the e2e suite;
final release check in `docs/plan/checks/w07-check.md`.

## Acceptance Criteria

- All CI gates from `infra/02` are green on the wave branch.
- Counter-integrity, EXPLAIN, contract-coverage and architecture tests pass.
- E2E happy path passes against the compose stack twice in a row (no flakiness); a11y scores ≥ 90.
- `validate-specs` reports `"valid": true`; every gap from w00–w06 is either resolved in the specs or still listed as Open.

## Out of Scope

New product features; anything in `Q-01`…`Q-08` unless the owner approves it.
