# Wave w04 — Gaps, Issues & Open Questions

> Automatically saved during wave validation (`wave-validate`) and compiled into `docs/questions-and-limitations/GAPS_AND_QUESTIONS.md` when the wave lands on `main`.

## Gaps
- [ ] **QL-w04-01** (`F-BE-06`, `backend`): `StoryServiceDeps` still adds `storage: MediaStorage` (file removal after `deleteStory`), `users: UserRepository` (resolve `username` in `getUserStories`) and an optional `logger`, none of which are in the backend/02 `StoryService` port list (carried over from QL-w00-03, still unresolved in the spec).
  - Suggested fix: Add `MediaStorage`, `UserRepository` and a logger port to the backend/02 `StoryService` row.
- [ ] **QL-w04-02** (`F-FE-09`, `frontend`): The author-only viewer list uses the query key `["storyViewers", storyId]` (staleTime 0), which is not in the frontend/02 query-key table, so W04-03 defined it in `apps/web/src/state/stories.ts` instead of `query-keys.ts`.
  - Suggested fix: Add `["storyViewers", storyId]` → `GET /stories/{id}/viewers`, 0 s to frontend/02 and move the key into `query-keys.ts` in a later wave.
- [ ] **QL-w04-03** (`F-CORE-01`, `specs`): The W04-04 task lists spec refs `F-BE-06` and `F-ECOMM-08` only, while the wave plan (docs/plan/waves/W04-stories.md) also covers and delivered `F-BE-09` (story cleanup), `F-FE-09`, `F-CORE-03` and `F-DB-04`.
  - Suggested fix: Align the w04 task `spec_refs` in WAVE_MANIFEST.json with the wave plan.
- [x] **QL-w04-15**: Duplicate of QL-w04-01, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-01; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-16**: Duplicate of QL-w04-02, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-02; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-17**: Duplicate of QL-w04-03, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-03; closed here in W04-VAL-2 round 1.
- [ ] **QL-w04-34**: StoryServiceDeps adds storage, users and an optional logger that are not in the backend/02 StoryService port list.
- [ ] **QL-w04-35**: Query key ["storyViewers", storyId] is not in the frontend/02 query-key table; it is defined in state/stories.ts.
- [ ] **QL-w04-36**: W04-04 task spec_refs list only F-BE-06 and F-ECOMM-08; the wave also delivered F-BE-09, F-FE-09, F-CORE-03, F-DB-04.

## Issues & Limitations
- [ ] **QL-w04-04** (`F-BE-06`, `backend`): `apps/api/src/main.ts` builds `StoryService` without its `logger`, so when `DELETE /api/v1/stories/{id}` commits but the file removal fails, the failure is silently swallowed instead of logged as backend/02 requires. `main.ts` is outside the w04 `owned_paths`, so it was not fixed here.
  - Suggested fix: Pass `logger: { error: (obj, msg) => logRef.current?.error(obj, msg) }` to `new StoryService(...)` in `main.ts` (same pattern as the event bus).
- [ ] **QL-w04-05** (`F-BE-09`, `backend`): When a file removal fails after a commit (in `deleteStory` or in `StoryCleanupJob`), the story and media rows are already deleted, so the file is orphaned permanently: "retried on the next tick" (backend/03) cannot happen because nothing references the key any more.
  - Suggested fix: Decide whether to accept the orphaned files (local disk) or add a storage sweep / outbox of failed keys (relates to `Q-06`).
- [ ] **QL-w04-06** (`F-BE-01`, `persistence`): QL-w01-08 is still open: `PgUserRepository.getProfileView` computes `has_active_story` with the database `now()` instead of the injected `Clock`. `users.pg-repository.ts` is outside the w04 `owned_paths`; the profile ring can disagree with fake-clock tests but is correct in production.
  - Suggested fix: Pass `clock.now()` as a query parameter in the identity owner's next wave.
- [ ] **QL-w04-07** (`F-INFRA-04`, `infra`): Docker is not available in the validation sandbox, so the slot-4 compose stack (`yd-insta-w04`, web 21080, api 21081) was only rendered; `compose-wave.mjs --up` fails because there is no `docker` binary. Substitute evidence: a live API smoke run of the real server on port 21081 against PostgreSQL 16.13 (create story → second account sees it in the tray → seen → author's viewer list → 403s → delete removes row and file). The browser UI was not clicked through.
  - Suggested fix: Owner runs check-guide steps 5–12 on a Docker host before landing.
- [ ] **QL-w04-08** (`F-INFRA-05`, `infra`): As in QL-w01-06, the rendered `.yardos/waves/w04/.env.wave` has no `POSTGRES_PASSWORD`, so `compose-wave.mjs --up` fails unless it is exported in the calling shell.
  - Suggested fix: `export POSTGRES_PASSWORD=$(openssl rand -hex 16)` before `up` (check-guide step 5); the deploy skill should generate it.
- [ ] **QL-w04-09** (`F-INFRA-04`, `infra`): `.yardos/` is gitignored, so `.yardos/waves/w04/review-packet.json` and the compose bundle exist only in the validator's working tree and are not part of the wave branch (same as QL-w01-07).
  - Suggested fix: Orchestrator reads the packet from the job worktree, or un-ignore `.yardos/waves/*/review-packet.json`.
- [ ] **QL-w04-10** (`F-ECOMM-08`, `external-communication`): The follow endpoints belong to w03 and are not on `wave/w04-stories` (`POST /api/v1/users/{username}/follow` → 404), so another user's stories can only reach a tray in the w04 preview after inserting a `follows` row with SQL. This resolves when w03 lands and is synced into w04.
  - Suggested fix: None needed for w04; re-check the tray flow after `wave-sync`.
- [ ] **QL-w04-11** (`F-FE-09`, `frontend`): `StoryTray` is exported but not placed on `HomePage` (w05 scope), so in the w04 preview the tray is not visible in the UI. The viewer is reached directly at `/stories/:username` and story creation at `/create/story` (also linked from `/create`).
  - Suggested fix: None for w04; w05 places the tray on `HomePage`.
- [ ] **QL-w04-12** (`F-DB-04`, `infra`): There is no Docker or system Postgres in the sandbox; integration tests ran on embedded PostgreSQL 16.13. There is no Playwright E2E suite yet (scheduled for w07), so the story viewer, tray and create flows are covered only by component tests with a mocked API and fake timers.
  - Suggested fix: CI on `postgres:16-alpine` stays authoritative; add story E2E in w07.
- [ ] **QL-w04-13** (`F-CORE-03`, `infra`): `tsc -p apps/api/test/tsconfig.json` reports one error in a w01 file (`apps/api/test/integration/identity/identity.test.ts:122`, `password_hash` on a possibly-undefined row). Vitest is not affected and `npm run typecheck` does not include the test tsconfig, so this does not block CI; no w04 test file has type errors.
  - Suggested fix: Add a non-null assertion in the identity test, and include `apps/api/test` in `npm run typecheck`.
- [x] **QL-w04-18**: Duplicate of QL-w04-04, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-04; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-19**: Duplicate of QL-w04-05, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-05; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-20**: Duplicate of QL-w04-06, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-06; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-21**: Duplicate of QL-w04-07, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-07; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-22**: Duplicate of QL-w04-08, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-08; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-23**: Duplicate of QL-w04-09, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-09; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-24**: Duplicate of QL-w04-10, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-10; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-25**: Duplicate of QL-w04-11, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-11; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-26**: Duplicate of QL-w04-12, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-12; closed here in W04-VAL-2 round 1.
- [x] **QL-w04-27**: Duplicate of QL-w04-13, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-13; closed here in W04-VAL-2 round 1.
- [ ] **QL-w04-29** (`F-DB-04`, `infra`): In `wave-sync.mjs`, `MIGRATION_FILE_RE` only matches `migrations/`, `db/migrations/` and `prisma/migrations/`, so it never detects collisions in this repo's `apps/api/migrations/`. W04-SYNC-1 had no collision (neither side added a migration since merge-base `af94d81`), which was checked by hand.
  - Suggested fix: Match `(?:.*/)?migrations/NNNN_*.sql`, or make the directory configurable.
- [ ] **QL-w04-30** (`F-INFRA-04`, `infra`): `wave-sync.mjs` has no `--help`, ignores unknown flags and defaults to `--wave w01`. A bare `--help` ran a real sync and created a local `wave/w01-backend-and-persistence` ref; it was not pushed and was deleted at once.
  - Suggested fix: Make `--wave` required and reject unknown flags.
- [ ] **QL-w04-31** (`F-INFRA-04`, `infra`): `--sync-issues` only looks at local `refs/heads/issue/WNN-*`, so issue branches that exist only on the remote are skipped without a message. For w04, `issue/W04-02` and `issue/W04-03` are already fully merged into the wave (0 commits ahead), so nothing needed to be propagated.
  - Suggested fix: Also look at `<remote>/issue/WNN-*`, and skip branches that are already merged.
- [ ] **QL-w04-32** (`F-INFRA-04`, `infra`): In the sandbox, running `npm ci` as the `--test-cmd` gate fails in the `/tmp` sync worktree (argon2 install script exits 126, so `/tmp` is likely noexec). The gate passed after symlinking `node_modules` from the job worktree into the sync worktree. Also, `git push` has no credentials, so the synced `wave/w04-stories` (`170de32`) exists only locally and on the job branch. Update (W04-VAL-2 round 1): `origin/wave/w04-stories` now points at `f32f22e`, which contains `170de32`, so the push part is resolved; the `/tmp` noexec part stays open.
  - Suggested fix: Create the sync worktree under the repo or `$TMPDIR` with exec rights, and have the orchestrator push the wave ref.
- [ ] **QL-w04-33** (`F-INFRA-04`, `infra`): `validate-wave.mjs` reports `files_changed_count` as the number of all source files (476) when the worktree is clean, because it counts `git status --porcelain` lines and falls back to every file. The real wave diff against the refreshed `main` (`1c2510e`) is 36 files, all inside the w04 `owned_paths`.
  - Suggested fix: Count `git diff --name-only <merge-base with main>..HEAD` instead.
- [ ] **QL-w04-37**: main.ts (w00-owned) builds StoryService without logger, so a failed post-commit file removal in DELETE /stories/{id} is not logged.
- [ ] **QL-w04-38**: A failed file removal after commit (deleteStory or StoryCleanupJob) leaves the file orphaned permanently; it cannot be retried.
- [ ] **QL-w04-39**: QL-w01-08 still open: getProfileView computes has_active_story with DB now() instead of the injected Clock.
- [ ] **QL-w04-40**: No Docker in the sandbox: slot-4 compose stack rendered only; browser UI not clicked through; owner must run guide steps 5-14 on a Docker host.
- [ ] **QL-w04-41**: .env.wave has no POSTGRES_PASSWORD, so compose --up fails unless it is exported in the shell.
- [ ] **QL-w04-42**: .yardos/ is gitignored, so review-packet.json and the compose bundle are not on the wave branch.
- [ ] **QL-w04-43**: w03 follow API is absent on wave/w04-stories; the preview tray needs a follows row inserted via SQL.
- [ ] **QL-w04-44**: StoryTray is not yet placed on HomePage (w05 scope); viewer and create pages are reached by URL.
- [ ] **QL-w04-45**: Integration tests ran on embedded PostgreSQL 16.13; no Playwright E2E yet (w07), web flows covered by component tests only.
- [ ] **QL-w04-46**: api test tsconfig has one type error in w01 identity.test.ts:122; not covered by npm run typecheck.
- [ ] **QL-w04-47**: wave-sync.mjs MIGRATION_FILE_RE never matches apps/api/migrations/, so migration collisions are not detected.
- [ ] **QL-w04-48**: wave-sync.mjs has no --help, ignores unknown flags and defaults to --wave w01.
- [ ] **QL-w04-49**: --sync-issues only checks local issue/WNN-* branches and silently skips remote-only ones.
- [ ] **QL-w04-50**: /tmp sync worktree cannot run npm ci (likely noexec); push part resolved (origin/wave/w04-stories at f32f22e).
- [ ] **QL-w04-51**: validate-wave.mjs reports files_changed_count as all source files (476) on a clean worktree; real wave diff vs main is 36 files.

## Open Questions
- [ ] **QL-w04-14** (`F-CORE-01`, `specs`): A 2026-11-18 planning note says w04 was cancelled after w01 failed, but w01 landed in `f94739b` and W04-01..W04-03 are merged into `wave/w04-stories`. Is w04 active and cleared to land?
- [x] **QL-w04-28**: Duplicate of QL-w04-14, written again in a shorter form by an earlier ledger update. Tracked under QL-w04-14; closed here in W04-VAL-2 round 1.
- [ ] **QL-w04-52**: A planning note says w04 was cancelled after w01 failed, but w01 landed (f94739b) and W04-01..03 are merged. Is w04 active and cleared to land?
