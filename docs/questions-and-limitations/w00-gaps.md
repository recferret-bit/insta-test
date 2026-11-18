# Wave w00 — Gaps, Issues & Open Questions

> Automatically saved during wave validation (`wave-validate`) and compiled into `docs/questions-and-limitations/GAPS_AND_QUESTIONS.md` when the wave lands on `main`.

## Gaps
- [ ] **QL-w00-01** (`F-FE-12`, `frontend`): frontend/02 names the SSE client module `state/live.ts`, but the wave plan (W00-03) and the code use `apps/web/src/state/sse.ts`.
  - Suggested fix: Rename the spec section to `state/sse.ts` (code and wave plan agree); no code change.
- [ ] **QL-w00-02** (`F-FE-01`, `frontend`): The frontend spec does not say which `apps/web/src/api/*.ts` module hosts cross-resource calls; W00-03 put feed/explore/like in `api/posts.ts`, follow/unfollow in `api/users.ts` and hashtag posts in `api/search.ts`.
  - Suggested fix: Record this placement in frontend/01 or 02 so w02–w05 keep it.
- [ ] **QL-w00-03** (`F-CORE-03`, `backend`): `StoryServiceDeps` adds `storage: MediaStorage` (delete the file after `deleteStory` commits) and `users: UserRepository` (resolve `username` in `getUserStories`); neither is in the backend/02 port list.
  - Suggested fix: Add both ports to backend/02 `StoryService` before w04 relies on them.
- [ ] **QL-w00-04** (`F-ICOMM-01`, `internal-communication`): Search `limit` defaults to `LIMITS.searchLimitDefault` = 10 in `packages/contracts/src/dto/search.ts`; the spec states a max but no default.
  - Suggested fix: Confirm 10 and add it to external-communication/06 and internal-communication/01.
- [ ] **QL-w00-05** (`F-INFRA-04`, `infra`): infra/01 defines the wave port block as `18000 + NN*10` (10 ports) rendered to `.env.wave-<wNN>`, while the wave-compose-deploy skill and the wave plan use `21000 + slot*20` (20 ports) in `.yardos/waves/<wNN>/.env.wave`.
  - Suggested fix: Update infra/01 + infra/02 to the skill's scheme (21000 + slot*20, `.yardos/waves/<wNN>/`); keep 18000/18001 as plain-compose defaults.
- [ ] **QL-w00-14**: frontend/02 names the SSE client state/live.ts; the code and wave plan use apps/web/src/state/sse.ts.
- [ ] **QL-w00-15**: The spec does not say which web api/*.ts module hosts feed/explore/like, follow and hashtag-post calls (placed in posts.ts, users.ts and search.ts).
- [ ] **QL-w00-16**: StoryServiceDeps adds storage: MediaStorage and users: UserRepository, which are not in the backend/02 port list.
- [ ] **QL-w00-17**: Search limit default 10 (LIMITS.searchLimitDefault) is not in the spec.
- [ ] **QL-w00-18**: infra/01 wave port block (18000 + NN*10, .env.wave-<wNN>) differs from the deploy skill and wave plan (21000 + slot*20, .yardos/waves/<wNN>/.env.wave).

## Issues & Limitations
- [ ] **QL-w00-06** (`F-INFRA-01`, `infra`): Docker is not available in the validation sandbox, so image builds, the API image size cap (< 250 MB), the nginx config, `docker compose up --wait` health and the two-stack side-by-side run (F-INFRA-03/04) were NOT executed; only the compose render and a static isolation diff (slot 0 vs slot 1) were checked.
  - Suggested fix: Owner runs check-guide steps 6–12 on a Docker host before landing.
- [ ] **QL-w00-07** (`F-INFRA-05`, `infra`): The wave-compose-deploy bundle `.env.wave` has no `POSTGRES_PASSWORD`, but compose requires `${POSTGRES_PASSWORD:?}`, so `compose-wave.mjs --up` fails unless the variable is exported in the calling shell (infra/02 expects a random per-wave value).
  - Suggested fix: Export `POSTGRES_PASSWORD=$(openssl rand -hex 16)` before `--up` (see check guide step 6); longer-term the skill should generate it.
- [ ] **QL-w00-08** (`F-INFRA-04`, `infra`): The wave overlay hard-codes `PUBLIC_URL`/`PUBLIC_API_URL`/`CORS_ORIGIN` to `*.apps.localhost:9080` proxy URLs, which only work behind the Hoster proxy; browsing `http://localhost:21000` directly gives an SPA whose `apiUrl` points at the proxy, and `compose-wave.mjs --up` does not pass `--wait`.
  - Suggested fix: For direct-port checks use the `compose.local.yml` override from check-guide step 6.
- [x] **QL-w00-09** (`F-INFRA-04`, `infra`): wave-compose-deploy assigns port offsets in compose declaration order; with `api` declared before `web` it mapped api→21000 and web→21001 and pointed `PUBLIC_URL`/`CORS_ORIGIN` at the API. Fixed in W00-05 by declaring `web` before `api` in `docker-compose.yml` (web 21000, api 21001).
- [x] **QL-w00-10** (`F-CORE-02`, `specs`): `import/no-restricted-paths` zones resolved against `process.cwd()`, so layer rules were silently off when ESLint ran from a workspace directory (IDE, `apps/api`). Fixed in W00-05 with `basePath: import.meta.dirname` in `eslint.config.js` plus `apps/api/test/unit/shared/layer-boundaries.test.ts` (6 lint-fixture tests).
- [ ] **QL-w00-11** (`F-DB-01`, `persistence`): Integration tests (41/41) were run against PGlite 0.3 (WASM Postgres via `@electric-sql/pglite-socket`, with `pg_trgm`) and not PostgreSQL 16; the CI `compose-e2e`/integration job on `postgres:16-alpine` is the authoritative run.
  - Suggested fix: Run check-guide step 4 against `postgres:16-alpine`.
- [ ] **QL-w00-12** (`F-INFRA-06`, `infra`): No E2E specs exist yet (Playwright location `apps/web/e2e/` is decision P-4, delivered in w07); the CI e2e step tolerates "no specs".
- [ ] **QL-w00-19**: No Docker in the sandbox: image builds, api image < 250 MB, nginx, compose up --wait and the two-stack side-by-side run were not executed (owner runs guide steps 6–13).
- [ ] **QL-w00-20**: .env.wave has no POSTGRES_PASSWORD, so compose-wave --up fails unless it is exported.
- [ ] **QL-w00-21**: The wave overlay hard-codes proxy URLs (*.apps.localhost:9080) and --up does not --wait; direct-port testing needs the compose.local.yml override.
- [x] **QL-w00-22**: compose-wave mapped api→21000 and web→21001 because of declaration order; fixed by declaring web before api.
- [x] **QL-w00-23**: ESLint import/no-restricted-paths depended on cwd; fixed with basePath plus the layer-boundaries regression test.
- [ ] **QL-w00-24**: Integration tests ran against PGlite, not PostgreSQL 16; the CI run on postgres:16-alpine is authoritative.
- [ ] **QL-w00-25**: No E2E specs until w07 (P-4: apps/web/e2e/).
- [ ] **QL-w00-26** (`F-INFRA-07`, `persistence`): During W00-LAND-R1 the integration suite ran 40/41 against PGlite (0.3.15 and 0.5.16 via `@electric-sql/pglite-socket`), not the 41/41 that the check guide reports. `startup.test.ts` "runJobOnce holds a real advisory lock…" fails because the PGlite socket server accepts only one connection at a time: the job holds a pooled client, and the test's second `pool.query` times out, so the job returns `failed`. This is a test-environment limit, not a code defect.
  - Suggested fix: Treat the CI integration job on `postgres:16-alpine` as the gate (see QL-w00-11/24); optionally skip this one test when the test DB is PGlite.

## Open Questions
- [ ] **QL-w00-13** (`F-INFRA-04`, `infra`): Which wave port scheme is canonical: infra/01 (`18000 + NN*10`) or the deploy skill (`21000 + slot*20`)?
  - Suggested fix: Proposed: the skill's scheme (see the related gap); owner to confirm.
