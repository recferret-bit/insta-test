# W06 — Hardening: gap remediation, integrity & index tests, e2e, full CI

- **Wave:** `w06` · branch `wave/w06-hardening-e2e` from `main` after `w03`, `w04`, `w05` land · depends on: `w03`, `w04`, `w05`
- **Preview:** slot 6 → web `21120`, api `21121` (`yd-insta-w06`)
- **Exact `owned_paths`:** see `w06` in [WAVE_MANIFEST.json](../WAVE_MANIFEST.json)
- **Inputs:** [GAPS_AND_QUESTIONS.md](../../questions-and-limitations/GAPS_AND_QUESTIONS.md) and every `wNN-gaps.md`; the testing pyramid in [02-architecture-and-patterns.md](../../specs/specs/02-architecture-and-patterns.md); CI gates in [infra/02](../../specs/infra/02-env-ci-and-probes.md)

## Goal

Make the product a release candidate:

- close the gaps recorded by earlier waves (spec first);
- prove the system-wide properties: schema shape, index use, counter integrity, mapper coverage;
- add the Playwright happy path and Lighthouse a11y checks;
- turn on every CI gate.

## Tasks

| Task | Kind | Scope | Spec refs |
|---|---|---|---|
| W06-01 | contracts | Triage all gap ledgers. Update `docs/specs` first (spec validation must pass), then `packages/contracts`. Write `apps/api/migrations/0002_hardening.sql` **only** if a gap needs a schema change. Hand the remediation list to W06-02 in `w06-gaps-W06-01.md`. | F-CORE-03, F-DB-01, F-DB-02 |
| W06-02 | worker | Carry out the remediation list in `apps/api/src` and `apps/web/src`. | F-CORE-02, F-CORE-05, F-ECOMM-12 |
| W06-03 | worker | `test/integration/hardening` (information_schema vs spec, checksum tamper, `EXPLAIN` on seeded data, randomized counter recomputation), `test/unit/hardening` (LIMITS/ErrorCode sync, every ENT-* mapper pair has a round-trip test), `apps/api/scripts/seed.ts`. | F-DB-01, F-DB-03, F-DB-05, F-CORE-03 |
| W06-04 | worker | `apps/web/e2e` happy path (sign up → upload → post → like → comment → follow → story), `playwright.config.ts`, `lighthouserc.json` (a11y ≥ 90 on Home/Profile/Post), the full `.github/workflows/ci.yml` (all 9 gates, two side-by-side compose stacks). | F-INFRA-03, F-INFRA-04, F-INFRA-06, F-FE-11 |
| W06-05 | validate | wave-validate ×2 over the whole product; mark resolved gaps; `w06-check.md`, `w06-gaps.md`, review packet. | — |

`W06-02` (`apps/api/src`, `apps/web/src`), `W06-03` (`apps/api/test/*/hardening`, `apps/api/scripts`) and `W06-04` (`apps/web/e2e`, Playwright/Lighthouse configs, `.github/workflows`) are pairwise disjoint.

## Acceptance criteria

- Every `F-*` acceptance criterion in `docs/specs/**` holds. Each one is listed in `w06-check.md` with its evidence (test name or manual step).
- CI: spec validation, lint, typecheck, unit, integration, build, compose smoke, e2e + Lighthouse, and the outbound-HTTP grep gate are all required and green.
- `INV-05`: after a randomized sequence of like/unlike/comment/delete/follow/unfollow/post/delete actions, every counter equals a recount of its source rows.
- Each gap from w00–w05 is `Resolved` or kept `Open` with a written reason for the owner.
